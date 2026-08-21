import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";

import { adCampaignFundingsTable, adCampaignsTable, adRevenueMovementsTable, cinemaTitleAssetsTable, clipsTable, creatorBalanceMovementsTable, creatorBalancesTable, creatorFeePoliciesTable, customerWalletBalancesTable, customerWalletDepositAddressesTable, customerWalletMovementsTable, db, paymentEventsTable, paymentIntentsTable, channelsTable, platformRevenueMovementsTable, subscriptionsTable, tipsTable, usersTable, videosTable, streamSessionsTable } from "@workspace/db";
import { addCryptoAmounts, compareCryptoAmounts, KRYV_PLATFORM_FEE_BPS, normalizeCryptoAmount, quoteCreatorPlatformFee, type CreatorFeeQuote } from "../lib/creatorFees";
import { enqueueDurableJob } from "../lib/jobs";
import {
  fanoutFollowedContentNotifications,
  fanoutFollowedLiveNotifications,
  type FollowedContentNotificationInput,
  type FollowedLiveNotificationInput,
} from "../lib/notificationFanout";
import { deleteSharedKey, publishRealtimeEvent } from "../lib/realtime";
import { logger } from "../lib/logger";
import { fastpix } from "../lib/fastpix";
import { isPlisioConfigured, isSupportedKryvCryptoCode, verifyPlisioJsonCallback } from "../lib/plisio";

const router: IRouter = Router();
const DISCOVER_SUMMARY_CACHE_KEY = "kryv:discover:summary:v1";

async function dispatchNotificationFanout(
  id: string,
  payload: Record<string, unknown>,
  fallback: () => Promise<void>,
) {
  const queued = await enqueueDurableJob({
    id,
    type: "notification.fanout",
    occurredAt: new Date().toISOString(),
    payload,
    // A replay after partial recipient insertion can produce duplicate alerts.
    // Keep failures durable and operator-visible until receipt idempotency ships.
    maxAttempts: 1,
  });
  if (!queued) await fallback();
}

function publishAuthoritativeLiveState(channel: { id: number; isLive: boolean; viewerCount: number; fastpixPlaybackId: string | null }, providerEvent: string) {
  const occurredAt = new Date().toISOString();
  deleteSharedKey(DISCOVER_SUMMARY_CACHE_KEY).catch(() => undefined);
  publishRealtimeEvent({
    type: "live.state.updated",
    channelId: channel.id,
    occurredAt,
    data: { isLive: channel.isLive, viewerCount: channel.viewerCount, hasPlayback: Boolean(channel.fastpixPlaybackId), providerEvent },
  }).catch(() => undefined);
  enqueueDurableJob({
    id: `live-state:${providerEvent}:${channel.id}:${occurredAt}`,
    type: "analytics.event",
    occurredAt,
    payload: { event: "live.state.updated", channelId: channel.id, isLive: channel.isLive, viewerCount: channel.viewerCount, providerEvent },
  }).catch(() => undefined);
}

type SettlementFeeAllocation = CreatorFeeQuote & {
  feePolicyId: number | null;
  feePolicyVersion: number | null;
};

async function quoteActiveSettlementFee(txn: any, paymentKind: "subscription" | "tip", grossAmount: string): Promise<SettlementFeeAllocation> {
  const now = new Date();
  const [policy] = await txn
    .select()
    .from(creatorFeePoliciesTable)
    .where(and(
      eq(creatorFeePoliciesTable.paymentKind, paymentKind),
      eq(creatorFeePoliciesTable.status, "active"),
      or(isNull(creatorFeePoliciesTable.effectiveAt), lte(creatorFeePoliciesTable.effectiveAt, now)),
    ))
    .orderBy(desc(creatorFeePoliciesTable.version))
    .limit(1);

  // The migration seeds versioned policies; this default protects the public 95/5
  // economics if a newly provisioned environment has not seeded policy rows yet.
  const quote = quoteCreatorPlatformFee(grossAmount, policy?.platformFeeBps ?? KRYV_PLATFORM_FEE_BPS);
  return { ...quote, feePolicyId: policy?.id ?? null, feePolicyVersion: policy?.version ?? null };
}

type VerifiedPlisioSettlementTerms = {
  receivedAmount: string;
  invoiceAmount: string;
  invoiceCommission: string;
  invoiceTotal: string;
  currency: string;
};

function settledGuestDisplayName(metadata: Record<string, unknown>) {
  if (metadata.guestCheckout !== true || typeof metadata.senderDisplayName !== "string") return null;
  const normalized = metadata.senderDisplayName.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > 48 || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

function verifiedPlisioSettlementTerms(callback: Record<string, unknown>): VerifiedPlisioSettlementTerms {
  const value = (field: "amount" | "invoice_sum" | "invoice_commission" | "invoice_total_sum") => {
    const raw = callback[field];
    if (typeof raw !== "string") throw new Error(`Completed crypto callback is missing ${field}.`);
    return normalizeCryptoAmount(raw);
  };
  const currency = typeof callback.currency === "string" ? callback.currency.toUpperCase() : "";
  if (!isSupportedKryvCryptoCode(currency)) throw new Error("Completed crypto callback has an unsupported currency.");

  const receivedAmount = value("amount");
  const invoiceAmount = value("invoice_sum");
  const invoiceCommission = value("invoice_commission");
  const invoiceTotal = value("invoice_total_sum");
  if (addCryptoAmounts(invoiceAmount, invoiceCommission) !== invoiceTotal) {
    throw new Error("Completed crypto callback has inconsistent invoice commission totals.");
  }
  if (compareCryptoAmounts(receivedAmount, invoiceTotal) < 0) {
    throw new Error("Completed crypto callback received less than the provider-confirmed invoice total.");
  }
  return { receivedAmount, invoiceAmount, invoiceCommission, invoiceTotal, currency };
}

type VerifiedPlisioDepositTerms = {
  depositUid: string;
  receivedAmount: string;
  depositAmount: string;
  invoiceCommission: string;
  invoiceTotal: string;
  currency: string;
  walletHash: string;
};

function verifiedPlisioDepositTerms(callback: Record<string, unknown>): VerifiedPlisioDepositTerms {
  const value = (field: "amount" | "deposit_sum" | "invoice_commission" | "invoice_total_sum") => {
    const raw = callback[field];
    if (typeof raw !== "string") throw new Error(`Completed wallet deposit callback is missing ${field}.`);
    return normalizeCryptoAmount(raw);
  };
  const depositUid = typeof callback.deposit_uid === "string" ? callback.deposit_uid.trim() : "";
  const walletHash = typeof callback.wallet_hash === "string" ? callback.wallet_hash.trim() : "";
  const currency = typeof callback.currency === "string" ? callback.currency.toUpperCase() : "";
  if (!/^[A-Za-z0-9:_-]{1,255}$/.test(depositUid) || walletHash.length < 10 || walletHash.length > 256 || /\s/.test(walletHash)) {
    throw new Error("Completed wallet deposit callback has invalid destination identity.");
  }
  if (!isSupportedKryvCryptoCode(currency)) throw new Error("Completed wallet deposit callback has an unsupported currency.");

  const receivedAmount = value("amount");
  const depositAmount = value("deposit_sum");
  const invoiceCommission = value("invoice_commission");
  const invoiceTotal = value("invoice_total_sum");
  if (addCryptoAmounts(depositAmount, invoiceCommission) !== invoiceTotal) {
    throw new Error("Completed wallet deposit callback has inconsistent provider commission totals.");
  }
  if (compareCryptoAmounts(receivedAmount, invoiceTotal) < 0 || compareCryptoAmounts(depositAmount, "0") <= 0) {
    throw new Error("Completed wallet deposit callback does not contain a fully settled positive deposit.");
  }
  return { depositUid, receivedAmount, depositAmount, invoiceCommission, invoiceTotal, currency, walletHash };
}

async function recordCustomerWalletDeposit(
  txn: any,
  input: {
    providerPaymentId: string;
    terms: VerifiedPlisioDepositTerms;
    callback: Record<string, unknown>;
  },
) {
  const [address] = await txn
    .select()
    .from(customerWalletDepositAddressesTable)
    .where(and(
      eq(customerWalletDepositAddressesTable.provider, "plisio"),
      eq(customerWalletDepositAddressesTable.providerDepositUid, input.terms.depositUid),
      eq(customerWalletDepositAddressesTable.currency, input.terms.currency),
      eq(customerWalletDepositAddressesTable.status, "active"),
    ))
    .limit(1);
  if (!address || address.depositAddress !== input.terms.walletHash) {
    throw new Error("Completed wallet deposit callback does not match an active Kryv deposit address.");
  }

  const transactionUrls = Array.isArray(input.callback.tx_urls)
    ? input.callback.tx_urls.filter((value): value is string => typeof value === "string" && value.length <= 2048).slice(0, 10)
    : [];
  const metadata = {
    provider: "plisio",
    providerPaymentId: input.providerPaymentId,
    providerDepositUid: input.terms.depositUid,
    receivedAmount: input.terms.receivedAmount,
    depositAmount: input.terms.depositAmount,
    invoiceCommission: input.terms.invoiceCommission,
    invoiceTotal: input.terms.invoiceTotal,
    transactionUrls,
  };
  const [movement] = await txn
    .insert(customerWalletMovementsTable)
    .values({
      userId: address.userId,
      currency: input.terms.currency,
      movementType: "provider_deposit_settled",
      availableDelta: input.terms.depositAmount,
      heldDelta: "0",
      pendingDelta: "0",
      sourceType: "provider_pay_in",
      sourceId: input.providerPaymentId,
      idempotencyKey: `customer-wallet-deposit:${input.providerPaymentId}`,
      metadata,
    })
    .onConflictDoNothing()
    .returning({ id: customerWalletMovementsTable.id });
  if (!movement) return { duplicate: true, userId: address.userId };

  await txn
    .insert(customerWalletBalancesTable)
    .values({ userId: address.userId, currency: input.terms.currency, availableAmount: input.terms.depositAmount })
    .onConflictDoUpdate({
      target: [customerWalletBalancesTable.userId, customerWalletBalancesTable.currency],
      set: {
        availableAmount: sql`${customerWalletBalancesTable.availableAmount} + ${input.terms.depositAmount}`,
        updatedAt: new Date(),
      },
    });
  return { duplicate: false, userId: address.userId };
}

async function recordCreatorSettlement(
  txn: any,
  input: {
    channelId: number;
    currency: string;
    paymentKind: "subscription" | "tip";
    sourceType: string;
    sourceId: string;
    providerPaymentId: string;
    paymentIntentId: number;
    allocation: SettlementFeeAllocation;
    metadata?: Record<string, unknown>;
  },
) {
  const { allocation } = input;
  const baseMetadata = {
    provider: "plisio",
    providerPaymentId: input.providerPaymentId,
    paymentIntentId: input.paymentIntentId,
    feePolicyId: allocation.feePolicyId,
    feePolicyVersion: allocation.feePolicyVersion,
    platformFeeBps: allocation.platformFeeBps,
    grossAmount: allocation.grossAmount,
    platformFeeAmount: allocation.platformFeeAmount,
    creatorNetAmount: allocation.creatorNetAmount,
    ...input.metadata,
  };

  const [grossMovement] = await txn
    .insert(creatorBalanceMovementsTable)
    .values({
      channelId: input.channelId,
      currency: input.currency,
      movementType: `${input.paymentKind}_gross_settled`,
      availableDelta: allocation.grossAmount,
      heldDelta: "0",
      pendingDelta: "0",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: `${input.paymentKind}-gross-credit:${input.providerPaymentId}`,
      metadata: baseMetadata,
    })
    .onConflictDoNothing()
    .returning({ id: creatorBalanceMovementsTable.id });
  if (!grossMovement) throw new Error(`Completed crypto ${input.paymentKind} is missing its immutable gross creator-ledger movement.`);

  const [platformRevenueMovement] = await txn
    .insert(platformRevenueMovementsTable)
    .values({
      channelId: input.channelId,
      currency: input.currency,
      paymentKind: input.paymentKind,
      grossAmount: allocation.grossAmount,
      platformFeeAmount: allocation.platformFeeAmount,
      creatorNetAmount: allocation.creatorNetAmount,
      feePolicyId: allocation.feePolicyId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: `${input.paymentKind}-platform-fee:${input.providerPaymentId}`,
      metadata: baseMetadata,
    })
    .onConflictDoNothing()
    .returning({ id: platformRevenueMovementsTable.id });
  if (!platformRevenueMovement) throw new Error(`Completed crypto ${input.paymentKind} is missing its immutable platform-revenue movement.`);

  if (allocation.platformFeeAmount !== "0") {
    const [feeDebit] = await txn
      .insert(creatorBalanceMovementsTable)
      .values({
        channelId: input.channelId,
        currency: input.currency,
        movementType: "platform_fee_withheld",
        availableDelta: `-${allocation.platformFeeAmount}`,
        heldDelta: "0",
        pendingDelta: "0",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: `${input.paymentKind}-platform-fee-debit:${input.providerPaymentId}`,
        metadata: baseMetadata,
      })
      .onConflictDoNothing()
      .returning({ id: creatorBalanceMovementsTable.id });
    if (!feeDebit) throw new Error(`Completed crypto ${input.paymentKind} is missing its immutable creator platform-fee debit.`);
  }

  await txn
    .insert(creatorBalancesTable)
    .values({ channelId: input.channelId, currency: input.currency, availableAmount: allocation.creatorNetAmount })
    .onConflictDoUpdate({
      target: [creatorBalancesTable.channelId, creatorBalancesTable.currency],
      set: {
        availableAmount: sql`${creatorBalancesTable.availableAmount} + ${allocation.creatorNetAmount}`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Plisio JSON callbacks are HMAC-verified before any persistence. A payment
 * event is recorded first; payment intent state and product effects are then
 * processed exactly once. The browser invoice-return route is never trusted.
 */
// State-free reachability probe for the merchant console. Provider settlement remains
// POST-only, JSON-only, signature-verified, and server-authoritative.
router.get("/webhooks/plisio", (_req, res): void => {
  res.status(200).type("text/plain").send("Kryv crypto settlement receiver ready");
});

router.post("/webhooks/plisio", async (req, res): Promise<void> => {
  const rawBody = req.body as Buffer;
  if (!isPlisioConfigured()) {
    res.status(503).json({ error: "Crypto callbacks are not configured" });
    return;
  }

  let callback: Record<string, unknown>;
  try {
    callback = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody));
  } catch {
    res.status(400).json({ error: "Invalid crypto callback payload" });
    return;
  }

  if (!verifyPlisioJsonCallback(callback)) {
    logger.warn({ transactionId: callback.txn_id }, "Rejected Plisio callback with invalid signature");
    res.status(400).json({ error: "Invalid crypto callback signature" });
    return;
  }

  const transactionId = typeof callback.txn_id === "string" ? callback.txn_id : "";
  const orderNumber = typeof callback.order_number === "string" ? callback.order_number : "";
  const providerStatus = typeof callback.status === "string" ? callback.status.toLowerCase() : "unknown";
  const providerIpnType = typeof callback.ipn_type === "string" ? callback.ipn_type.toLowerCase() : "invoice";
  if (!transactionId || (!orderNumber && providerIpnType !== "pay_in")) {
    res.status(400).json({ error: "Crypto callback is missing transaction identity" });
    return;
  }

  const providerEventId = `plisio:${transactionId}:${providerStatus}:${String(callback.confirmations ?? "")}`;
  const [event] = await db
    .insert(paymentEventsTable)
    .values({
      provider: "plisio",
      providerEventId,
      eventType: `${providerIpnType}.${providerStatus}`,
      processingStatus: "received",
      relatedProviderPaymentId: transactionId,
    })
    .onConflictDoUpdate({
      target: [paymentEventsTable.provider, paymentEventsTable.providerEventId],
      set: { processingStatus: "received", errorCode: null, processedAt: null },
      where: eq(paymentEventsTable.processingStatus, "failed"),
    })
    .returning({ id: paymentEventsTable.id });

  if (!event) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    if (providerIpnType === "pay_in") {
      if (providerStatus !== "completed") {
        await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
        res.status(200).json({ received: true, status: providerStatus });
        return;
      }
      let terms: VerifiedPlisioDepositTerms;
      try {
        terms = verifiedPlisioDepositTerms(callback);
      } catch (error) {
        await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: "invalid_deposit_terms" }).where(eq(paymentEventsTable.id, event.id));
        res.status(422).json({ error: error instanceof Error ? error.message : "Invalid wallet deposit terms" });
        return;
      }
      const deposit = await db.transaction((txn) => recordCustomerWalletDeposit(txn, { providerPaymentId: transactionId, terms, callback }));
      await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, duplicate: deposit.duplicate });
      return;
    }

    const [intent] = await db
      .select()
      .from(paymentIntentsTable)
      .where(and(eq(paymentIntentsTable.orderNumber, orderNumber), eq(paymentIntentsTable.provider, "plisio")))
      .limit(1);

    const [adFunding] = !intent
      ? await db.select().from(adCampaignFundingsTable).where(and(eq(adCampaignFundingsTable.orderNumber, orderNumber), eq(adCampaignFundingsTable.provider, "plisio"))).limit(1)
      : [undefined];

    if (!intent && adFunding) {
      if (providerStatus !== "completed") {
        const fundingStatus = ["cancelled", "expired"].includes(providerStatus) ? "cancelled" : providerStatus === "error" ? "failed" : "pending";
        await db.transaction(async (txn) => {
          await txn.update(adCampaignFundingsTable).set({ providerPaymentId: transactionId, status: fundingStatus, updatedAt: new Date() }).where(and(eq(adCampaignFundingsTable.id, adFunding.id), ne(adCampaignFundingsTable.status, "confirmed")));
          if (fundingStatus !== "pending") await txn.update(adCampaignsTable).set({ fundingStatus: "unfunded", updatedAt: new Date() }).where(eq(adCampaignsTable.id, adFunding.campaignId));
        });
        await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
        res.status(200).json({ received: true, status: fundingStatus });
        return;
      }
      let adTerms: VerifiedPlisioSettlementTerms;
      try {
        adTerms = verifiedPlisioSettlementTerms(callback);
      } catch (error) {
        await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: "invalid_ad_funding_terms" }).where(eq(paymentEventsTable.id, event.id));
        res.status(422).json({ error: error instanceof Error ? error.message : "Invalid advertiser crypto funding terms" });
        return;
      }
      const fundingSettlement = await db.transaction(async (txn) => {
        const [confirmedFunding] = await txn.update(adCampaignFundingsTable).set({
          providerPaymentId: transactionId,
          selectedCurrency: adTerms.currency,
          invoiceAmount: adTerms.invoiceAmount,
          invoiceCommission: adTerms.invoiceCommission,
          invoiceTotal: adTerms.invoiceTotal,
          receivedAmount: adTerms.receivedAmount,
          status: "confirmed",
          confirmedAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            ...((adFunding.metadata ?? {}) as Record<string, unknown>),
            settlement: { ...adTerms, providerFeePaidBy: "client", confirmations: typeof callback.confirmations === "string" || typeof callback.confirmations === "number" ? String(callback.confirmations) : null },
          },
        }).where(and(eq(adCampaignFundingsTable.id, adFunding.id), ne(adCampaignFundingsTable.status, "confirmed"))).returning();
        if (!confirmedFunding) return { duplicate: true };
        await txn.update(adCampaignsTable).set({ fundingStatus: "funded", updatedAt: new Date() }).where(eq(adCampaignsTable.id, adFunding.campaignId));
        await txn.insert(adRevenueMovementsTable).values({
          campaignId: adFunding.campaignId,
          fundingId: confirmedFunding.id,
          currency: adTerms.currency,
          movementType: "advertiser_funding_settled",
          grossAmount: adTerms.invoiceAmount,
          platformAmount: adTerms.invoiceAmount,
          creatorAmount: "0",
          sourceType: "ad_campaign_funding",
          sourceId: String(confirmedFunding.id),
          idempotencyKey: `ad-funding-settlement:${confirmedFunding.id}`,
          metadata: { fundingType: adFunding.fundingType, providerPaymentId: transactionId, ...adTerms, providerFeePaidBy: "client" },
        }).onConflictDoNothing();
        return { duplicate: false };
      });
      await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, advertiserFundingConfirmed: !fundingSettlement.duplicate, duplicate: fundingSettlement.duplicate });
      return;
    }

    if (!intent) {
      await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: "unknown_order", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, ignored: "unknown_order" });
      return;
    }

    if (providerStatus !== "completed") {
      const status = ["cancelled", "expired"].includes(providerStatus) ? "cancelled" : providerStatus === "error" ? "failed" : "pending";
      await db
        .update(paymentIntentsTable)
        .set({ providerPaymentId: transactionId, status, updatedAt: new Date() })
        .where(and(eq(paymentIntentsTable.id, intent.id), ne(paymentIntentsTable.status, "completed")));
      await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, status });
      return;
    }

    let terms: VerifiedPlisioSettlementTerms;
    try {
      terms = verifiedPlisioSettlementTerms(callback);
    } catch (error) {
      await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: "invalid_settlement_terms" }).where(eq(paymentEventsTable.id, event.id));
      res.status(422).json({ error: error instanceof Error ? error.message : "Invalid crypto settlement terms" });
      return;
    }

    const settlement = await db.transaction(async (txn) => {
      const [settledIntent] = await txn
        .update(paymentIntentsTable)
        .set({
          providerPaymentId: transactionId,
          status: "completed",
          completedAt: new Date(),
          metadata: {
            ...((intent.metadata ?? {}) as Record<string, unknown>),
            settlement: {
              receivedAmount: terms.receivedAmount,
              invoiceAmount: terms.invoiceAmount,
              invoiceCommission: terms.invoiceCommission,
              invoiceTotal: terms.invoiceTotal,
              currency: terms.currency,
              providerFeePaidBy: "client",
              confirmations: typeof callback.confirmations === "string" || typeof callback.confirmations === "number" ? String(callback.confirmations) : null,
            },
          },
          updatedAt: new Date(),
        })
        .where(and(eq(paymentIntentsTable.id, intent.id), ne(paymentIntentsTable.status, "completed")))
        .returning();
      if (!settledIntent) return { duplicate: true };

      if (settledIntent.paymentKind === "subscription" && settledIntent.receiverChannelId) {
        const metadata = (settledIntent.metadata ?? {}) as Record<string, unknown>;
        const tier = typeof metadata.tier === "number" && Number.isInteger(metadata.tier) ? metadata.tier : 1;
        const giftRecipientUserId = typeof metadata.giftRecipientUserId === "number" && Number.isSafeInteger(metadata.giftRecipientUserId)
          ? metadata.giftRecipientUserId
          : null;
        const intendedRecipientUserId = settledIntent.purchaserUserId ?? giftRecipientUserId;
        let settledRecipientUserId: number | null = null;

        if (intendedRecipientUserId) {
          const [recipient] = await txn.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, intendedRecipientUserId)).limit(1);
          if (recipient) {
            const [active] = await txn
              .select()
              .from(subscriptionsTable)
              .where(and(eq(subscriptionsTable.userId, recipient.id), eq(subscriptionsTable.channelId, settledIntent.receiverChannelId), eq(subscriptionsTable.status, "active")))
              .limit(1);
            const base = active?.expiresAt && active.expiresAt > new Date() ? active.expiresAt : new Date();
            const expiresAt = new Date(base);
            expiresAt.setMonth(expiresAt.getMonth() + 1);
            if (active) {
              await txn.update(subscriptionsTable).set({ tier, provider: "plisio", providerSubscriptionId: transactionId, providerPriceId: `tier_${tier}`, currentPeriodEnd: expiresAt, expiresAt }).where(eq(subscriptionsTable.id, active.id));
            } else {
              await txn.insert(subscriptionsTable).values({ userId: recipient.id, channelId: settledIntent.receiverChannelId, tier, status: "active", provider: "plisio", providerSubscriptionId: transactionId, providerPriceId: `tier_${tier}`, currentPeriodEnd: expiresAt, expiresAt });
            }
            settledRecipientUserId = recipient.id;
          }
        }

        const allocation = await quoteActiveSettlementFee(txn, "subscription", terms.invoiceAmount);
        await recordCreatorSettlement(txn, {
          channelId: settledIntent.receiverChannelId,
          currency: terms.currency,
          paymentKind: "subscription",
          sourceType: "payment_intent",
          sourceId: String(settledIntent.id),
          providerPaymentId: transactionId,
          paymentIntentId: settledIntent.id,
          allocation,
          metadata: {
            tier,
            ...terms,
            providerFeePaidBy: "client",
            guestCheckout: metadata.guestCheckout === true,
            senderDisplayName: settledGuestDisplayName(metadata),
            recipientUserId: settledRecipientUserId,
            recipientUsername: typeof metadata.giftRecipientUsername === "string" ? metadata.giftRecipientUsername : null,
          },
        });
      }

      if (settledIntent.paymentKind === "tip" && settledIntent.receiverChannelId) {
        const allocation = await quoteActiveSettlementFee(txn, "tip", terms.invoiceAmount);
        const metadata = (settledIntent.metadata ?? {}) as Record<string, unknown>;
        const [tip] = await txn
          .insert(tipsTable)
          .values({
            senderUserId: settledIntent.purchaserUserId ?? null,
            receiverChannelId: settledIntent.receiverChannelId,
            amount: terms.invoiceAmount,
            currency: terms.currency,
            provider: "plisio",
            providerPaymentIntentId: transactionId,
            platformFeeAmount: allocation.platformFeeAmount,
            status: "completed",
            message: typeof metadata.message === "string" ? metadata.message : null,
          })
          .onConflictDoNothing()
          .returning({ id: tipsTable.id });
        if (!tip) throw new Error("Completed crypto tip is missing its immutable settlement record.");
        await recordCreatorSettlement(txn, {
          channelId: settledIntent.receiverChannelId,
          currency: terms.currency,
          paymentKind: "tip",
          sourceType: "tip",
          sourceId: String(tip.id),
          providerPaymentId: transactionId,
          paymentIntentId: settledIntent.id,
          allocation,
          metadata: {
            ...terms,
            providerFeePaidBy: "client",
            guestCheckout: metadata.guestCheckout === true,
            senderDisplayName: settledGuestDisplayName(metadata),
          },
        });
      }
      return { duplicate: false };
    });

    if (settlement.duplicate) {
      await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    await db.update(paymentEventsTable).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(paymentEventsTable.id, event.id));
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error, transactionId, orderNumber }, "Plisio callback processing failed");
    await db.update(paymentEventsTable).set({ processingStatus: "failed", errorCode: error instanceof Error ? error.name : "unknown" }).where(eq(paymentEventsTable.id, event.id));
    res.status(500).json({ error: "Crypto callback processing failed" });
  }
});

/**
 * FastPix delivers live-stream state changes and on-demand asset processing
 * events here.
 *
 * Configure this URL in the FastPix dashboard:
 *   https://kryv-backend.onrender.com/api/webhooks/fastpix
 *
 * Set FASTPIX_WEBHOOK_SECRET in Render environment variables to the signing
 * secret shown in the FastPix dashboard so every event is verified.
 *
 * FastPix event types handled:
 *   video.live_stream.created/preparing/connected — cache playback readiness privately
 *   video.live_stream.active       — publish the stream to Kryv viewers
 *   video.live_stream.disconnected — retain state during the provider reconnect window
 *   video.live_stream.idle         — conclusively end the public session
 *   video.live_stream.updated      — generic status update
 *   video.live_stream.deleted      — stream deleted
 *   video.media.created            — upload started processing
 *   video.media.ready              — upload finished, playback available
 *   video.media.failed             — upload failed
 */
// State-free reachability probe for provider dashboard validation. It never receives
// or processes events; all state-changing delivery remains POST-only and signed.
router.get("/webhooks/fastpix", (_req, res): void => {
  res.status(200).type("text/plain").send("Kryv live event receiver ready");
});

router.post("/webhooks/fastpix", async (req, res): Promise<void> => {
  const rawBody = req.body as Buffer;
  const webhookSecret = process.env.FASTPIX_WEBHOOK_SECRET;

  let event: any;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);

    if (!webhookSecret) {
      // FastPix validates a new endpoint before it reveals its signing secret.
      // Acknowledge this bootstrap probe but deliberately persist no event and
      // execute no state change; normal delivery remains signature-mandatory.
      logger.warn("FASTPIX_WEBHOOK_SECRET is not configured; ignoring unsigned live-event bootstrap probe");
      res.status(200).json({ received: true, configured: false });
      return;
    }

    // Verify the unmodified raw payload before accepting a provider event.
    event = fastpix.webhooks.unwrap(
      bodyStr,
      req.headers as Record<string, string>,
    );
  } catch (err) {
    logger.warn({ err }, "Rejected FastPix webhook — signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "Received FastPix webhook");

  switch (event.type) {
    // ── Provisioning and encoder readiness: cache playback privately ────────
    case "video.live_stream.created":
    case "video.live_stream.preparing":
    case "video.live_stream.connected": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix connected event did not include a stream ID");
        break;
      }
      await db
        .update(channelsTable)
        .set({ ...(playbackId ? { fastpixPlaybackId: playbackId } : {}) })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId));
      break;
    }

    // ── Live stream is publicly active ─────────────────────────────────────
    case "video.live_stream.active": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix active event did not include a stream ID");
        break;
      }

      const [updatedChannel] = await db
        .update(channelsTable)
        .set({
          isLive: true,
          lastStreamAt: new Date(),
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
        .returning();

      // A FastPix event can be retried; only create one open session per channel.
      if (updatedChannel) {
        const [openSession] = await db
          .select({ id: streamSessionsTable.id })
          .from(streamSessionsTable)
          .where(
            and(
              eq(streamSessionsTable.channelId, updatedChannel.id),
              sql`${streamSessionsTable.endedAt} IS NULL`,
            ),
          );
        if (!openSession) {
          const [createdSession] = await db.insert(streamSessionsTable).values({
            channelId: updatedChannel.id,
            startedAt: new Date(),
            title: updatedChannel.streamTitle ?? null,
            categoryId: updatedChannel.categoryId ?? null,
            streamKey: updatedChannel.fastpixStreamKey ?? null,
          }).returning({ id: streamSessionsTable.id });
          await db
            .update(channelsTable)
            .set({ totalStreamCount: sql`${channelsTable.totalStreamCount} + 1` })
            .where(eq(channelsTable.id, updatedChannel.id));
          if (createdSession) {
            const input: FollowedLiveNotificationInput = {
              channelId: updatedChannel.id,
              channelSlug: updatedChannel.slug,
              channelDisplayName: updatedChannel.displayName,
              streamTitle: updatedChannel.streamTitle,
              streamSessionId: createdSession.id,
            };
            dispatchNotificationFanout(
              `notification-fanout:live:${createdSession.id}`,
              { kind: "live", ...input },
              () => fanoutFollowedLiveNotifications(input),
            ).catch((error) =>
              logger.error(
                {
                  error,
                  channelId: updatedChannel.id,
                  streamSessionId: createdSession.id,
                },
                "Unable to dispatch followed-live inbox alerts",
              ),
            );
          }
        }
        publishAuthoritativeLiveState(updatedChannel, event.type);
      }
      break;
    }

    // ── A transient disconnect starts the provider reconnect window. Keep the
    // current public state intact; only idle conclusively ends the broadcast. ─
    case "video.live_stream.disconnected": {
      const streamId = event.data?.streamId ?? event.data?.id;
      logger.info({ streamId }, "Live encoder disconnected; retaining state during reconnect window");
      break;
    }

    // ── The reconnect window elapsed and the live stream is conclusively off ─
    case "video.live_stream.idle": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix offline event did not include a stream ID");
        break;
      }

      // Find the channel to get its ID for session closure
      const [offlineChannel] = await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
        .returning();

      // Close the most recent open stream session
      if (offlineChannel) {
        const now = new Date();
        await db
          .update(streamSessionsTable)
          .set({
            endedAt: now,
            durationSeconds: sql`EXTRACT(EPOCH FROM (${now.toISOString()} - started_at))::integer`,
          })
          .where(
            and(
              eq(streamSessionsTable.channelId, offlineChannel.id),
              sql`${streamSessionsTable.endedAt} IS NULL`,
            )
          );
        publishAuthoritativeLiveState(offlineChannel, event.type);
      }
      break;
    }

    // ── Generic status update (check status field) ─────────────────────────
    case "video.live_stream.updated": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      const playbackId = liveStream.playbackIds?.[0]?.id ?? null;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix update event did not include a stream ID");
        break;
      }
      const providerStatus = typeof liveStream.status === "string" ? liveStream.status : null;
      const nextLiveState = providerStatus === "active" ? true : ["idle", "disabled"].includes(providerStatus ?? "") ? false : undefined;
      const [updatedChannel] = await db
        .update(channelsTable)
        .set({
          ...(nextLiveState !== undefined ? { isLive: nextLiveState, viewerCount: nextLiveState ? (liveStream.viewerCount ?? 0) : 0 } : {}),
          ...(playbackId ? { fastpixPlaybackId: playbackId } : {}),
        })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
        .returning();

      if (updatedChannel && nextLiveState === false) {
        const now = new Date();
        await db
          .update(streamSessionsTable)
          .set({
            endedAt: now,
            durationSeconds: sql`EXTRACT(EPOCH FROM (${now.toISOString()} - started_at))::integer`,
          })
          .where(and(eq(streamSessionsTable.channelId, updatedChannel.id), sql`${streamSessionsTable.endedAt} IS NULL`));
      }

      if (updatedChannel && nextLiveState !== undefined) {
        publishAuthoritativeLiveState(updatedChannel, event.type);
      }

      // FastPix reports mediaIds once a recording has been created from the live stream.
      // Create a normal Kryv VOD record so later clip requests can reference the same asset.
      const mediaIds = Array.isArray(liveStream.mediaIds)
        ? liveStream.mediaIds.filter((mediaId: unknown): mediaId is string => typeof mediaId === "string")
        : [];
      if (updatedChannel && mediaIds.length > 0) {
        const [latestSession] = await db
          .select({ id: streamSessionsTable.id, title: streamSessionsTable.title })
          .from(streamSessionsTable)
          .where(eq(streamSessionsTable.channelId, updatedChannel.id))
          .orderBy(desc(streamSessionsTable.startedAt))
          .limit(1);

        for (const mediaId of mediaIds) {
          const [existingVideo] = await db
            .select({ id: videosTable.id })
            .from(videosTable)
            .where(eq(videosTable.fastpixAssetId, mediaId))
            .limit(1);

          const video = existingVideo
            ? existingVideo
            : (await db
                .insert(videosTable)
                .values({
                  channelId: updatedChannel.id,
                  title: latestSession?.title ?? updatedChannel.streamTitle ?? `${updatedChannel.displayName} live broadcast`,
                  categoryId: updatedChannel.categoryId,
                  contentType: "upload",
                  uploadStatus: "processing",
                  fastpixAssetId: mediaId,
                })
                .returning({ id: videosTable.id }))[0];

          if (latestSession && video) {
            await db
              .update(streamSessionsTable)
              .set({ vodVideoId: video.id })
              .where(eq(streamSessionsTable.id, latestSession.id));
          }
        }
      }
      break;
    }

    // ── Stream deleted ─────────────────────────────────────────────────────
    case "video.live_stream.deleted": {
      const liveStream = event.data ?? {};
      const streamId = liveStream.streamId ?? liveStream.id;
      if (!streamId) {
        logger.warn({ type: event.type }, "FastPix deleted event did not include a stream ID");
        break;
      }
      const [deletedChannel] = await db
        .update(channelsTable)
        .set({ isLive: false, viewerCount: 0 })
        .where(eq(channelsTable.fastpixLiveStreamId, streamId))
        .returning();
      if (deletedChannel) publishAuthoritativeLiveState(deletedChannel, event.type);
      break;
    }

    // ── VOD / upload processing ────────────────────────────────────────────
    case "video.media.ready": {
      const media = event.data ?? {};
      const mediaId = media.id ?? null;
      const playbackId = media.playbackIds?.[0]?.id ?? null;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      const durationSeconds = media.duration ? Math.round(media.duration) : null;

      const newlyReadyVideos: Array<{ id: number; channelId: number; title: string }> = [];
      const newlyReadyClips: Array<{ id: number; channelId: number; title: string }> = [];
      if (uploadId) {
        newlyReadyVideos.push(...await db
          .update(videosTable)
          .set({
            uploadStatus: "ready",
            fastpixAssetId: mediaId,
            fastpixPlaybackId: playbackId,
            durationSeconds,
          })
          .where(and(eq(videosTable.fastpixUploadId, uploadId), ne(videosTable.uploadStatus, "ready")))
          .returning({ id: videosTable.id, channelId: videosTable.channelId, title: videosTable.title }));
        await db
          .update(cinemaTitleAssetsTable)
          .set({
            processingStatus: "ready",
            fastpixMediaId: mediaId,
            fastpixPlaybackId: playbackId,
            durationSeconds,
            approvedAt: new Date(),
            processingError: null,
            updatedAt: new Date(),
          })
          .where(eq(cinemaTitleAssetsTable.fastpixUploadId, uploadId));
      }
      if (mediaId) {
        newlyReadyVideos.push(...await db
          .update(videosTable)
          .set({ uploadStatus: "ready", fastpixPlaybackId: playbackId, durationSeconds })
          .where(and(eq(videosTable.fastpixAssetId, mediaId), ne(videosTable.uploadStatus, "ready")))
          .returning({ id: videosTable.id, channelId: videosTable.channelId, title: videosTable.title }));
        await db
          .update(cinemaTitleAssetsTable)
          .set({ processingStatus: "ready", fastpixPlaybackId: playbackId, durationSeconds, processingError: null, updatedAt: new Date() })
          .where(eq(cinemaTitleAssetsTable.fastpixMediaId, mediaId));
        newlyReadyClips.push(...await db
          .update(clipsTable)
          .set({
            processingStatus: "ready",
            isPublished: true,
            fastpixPlaybackId: playbackId,
            ...(media.thumbnail ? { thumbnailUrl: media.thumbnail } : {}),
            ...(durationSeconds ? { durationSeconds } : {}),
            processingError: null,
          })
          .where(and(eq(clipsTable.fastpixMediaId, mediaId), ne(clipsTable.processingStatus, "ready")))
          .returning({ id: clipsTable.id, channelId: clipsTable.channelId, title: clipsTable.title }));
      }
      for (const video of newlyReadyVideos) {
        const input: FollowedContentNotificationInput = {
          channelId: video.channelId,
          notificationType: "watch_upload_ready",
          contentId: video.id,
          contentTitle: video.title,
        };
        dispatchNotificationFanout(
          `notification-fanout:watch_upload_ready:${video.id}`,
          { kind: input.notificationType, ...input },
          () => fanoutFollowedContentNotifications(input),
        ).catch((error) =>
          logger.error(
            { error, videoId: video.id, channelId: video.channelId },
            "Unable to dispatch Watch-ready inbox alerts",
          ),
        );
      }
      for (const clip of newlyReadyClips) {
        const input: FollowedContentNotificationInput = {
          channelId: clip.channelId,
          notificationType: "clip_ready",
          contentId: clip.id,
          contentTitle: clip.title,
        };
        dispatchNotificationFanout(
          `notification-fanout:clip_ready:${clip.id}`,
          { kind: input.notificationType, ...input },
          () => fanoutFollowedContentNotifications(input),
        ).catch((error) =>
          logger.error(
            { error, clipId: clip.id, channelId: clip.channelId },
            "Unable to dispatch Clip-ready inbox alerts",
          ),
        );
      }
      break;
    }

    case "video.media.failed": {
      const media = event.data ?? {};
      const mediaId = media.id ?? null;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      if (uploadId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "errored" })
          .where(eq(videosTable.fastpixUploadId, uploadId));
        await db
          .update(cinemaTitleAssetsTable)
          .set({ processingStatus: "errored", processingError: "The media provider could not process this Cinema asset.", updatedAt: new Date() })
          .where(eq(cinemaTitleAssetsTable.fastpixUploadId, uploadId));
      }
      if (mediaId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "errored" })
          .where(eq(videosTable.fastpixAssetId, mediaId));
        await db
          .update(cinemaTitleAssetsTable)
          .set({ processingStatus: "errored", processingError: "The media provider could not process this Cinema asset.", updatedAt: new Date() })
          .where(eq(cinemaTitleAssetsTable.fastpixMediaId, mediaId));
        await db
          .update(clipsTable)
          .set({ processingStatus: "errored", isPublished: false, processingError: "FastPix could not process this clip." })
          .where(eq(clipsTable.fastpixMediaId, mediaId));
      }
      break;
    }

    case "video.media.created": {
      const media = event.data;
      const uploadId = media.uploadId ?? (media as any).upload_id;
      if (uploadId) {
        await db
          .update(videosTable)
          .set({ uploadStatus: "processing", fastpixAssetId: media.id })
          .where(eq(videosTable.fastpixUploadId, uploadId));
        await db
          .update(cinemaTitleAssetsTable)
          .set({ processingStatus: "processing", fastpixMediaId: media.id ?? null, updatedAt: new Date() })
          .where(eq(cinemaTitleAssetsTable.fastpixUploadId, uploadId));
      }
      break;
    }

    default:
      logger.info({ type: event.type }, "Unhandled FastPix webhook event — ignored");
      break;
  }

  res.status(200).json({ received: true });
});

export default router;

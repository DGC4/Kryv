import crypto from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  channelsTable,
  creatorBalanceMovementsTable,
  creatorBalancesTable,
  creatorFeePoliciesTable,
  customerWalletBalancesTable,
  customerWalletMovementsTable,
  db,
  emotesTable,
  featureFlagsTable,
  paymentIntentsTable,
  platformRevenueMovementsTable,
  tipsTable,
} from "@workspace/db";
import {
  ListEmotesResponse,
  SubscribeBody,
  SubscribeResponse,
  TipBody,
  TipResponse,
  CreateWalletTipBody,
  CreateWalletTipResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { compareCryptoAmounts, KRYV_PLATFORM_FEE_BPS, normalizeCryptoAmount, quoteCreatorPlatformFee } from "../lib/creatorFees";
import { logActivity } from "../lib/tracking";
import {
  createPlisioInvoice,
  isPlisioConfigured,
  type KryvCryptoCode,
  PlisioNotConfiguredError,
} from "../lib/plisio";

const router: IRouter = Router();

class CryptoCommerceDisabledError extends Error {
  constructor() {
    super("Crypto commerce is not active yet. The owner must complete provider configuration and controlled activation before new invoices can be created.");
    this.name = "CryptoCommerceDisabledError";
  }
}

async function assertCryptoCommerceEnabled() {
  const [flag] = await db
    .select({ enabled: featureFlagsTable.enabled })
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, "crypto_commerce"))
    .limit(1);
  if (!flag?.enabled) throw new CryptoCommerceDisabledError();
}

class WalletPaymentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "WalletPaymentError";
  }
}

async function requireCryptoCommerceReadiness(_req: Request, res: Response, next: NextFunction) {
  try {
    if (!isPlisioConfigured()) throw new PlisioNotConfiguredError();
    await assertCryptoCommerceEnabled();
    next();
  } catch (error) {
    if (error instanceof PlisioNotConfiguredError || error instanceof CryptoCommerceDisabledError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
}

// Customer wallet custody is intentionally hard-disabled until its separate
// authorization, reconciliation, and support-control launch is complete.
const CUSTOMER_WALLET_RUNTIME_ENABLED = false;

function configuredSubscriptionAmount(tier: number) {
  const value = process.env[`KRYV_CRYPTO_SUB_TIER_${tier}_USD`]?.trim();
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
    throw new PlisioNotConfiguredError(`KRYV_CRYPTO_SUB_TIER_${tier}_USD must be configured to start crypto subscriptions.`);
  }
  return value;
}

async function assertCustomerWalletCustodyEnabled() {
  if (!CUSTOMER_WALLET_RUNTIME_ENABLED) {
    throw new WalletPaymentError("Kryv Wallet is not active yet. Deposit and wallet-payment controls remain disabled until the custody launch gate is complete.", 403);
  }
  const [flag] = await db
    .select({ enabled: featureFlagsTable.enabled })
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, "customer_wallet_custody"))
    .limit(1);
  if (!flag?.enabled) throw new WalletPaymentError("Kryv Wallet is not active yet. Deposit and wallet-payment controls must be reconciled before funds can move internally.", 403);
}

async function quoteWalletTipFee(txn: any, grossAmount: string) {
  const now = new Date();
  const [policy] = await txn
    .select()
    .from(creatorFeePoliciesTable)
    .where(and(
      eq(creatorFeePoliciesTable.paymentKind, "tip"),
      eq(creatorFeePoliciesTable.status, "active"),
      or(isNull(creatorFeePoliciesTable.effectiveAt), lte(creatorFeePoliciesTable.effectiveAt, now)),
    ))
    .orderBy(desc(creatorFeePoliciesTable.version))
    .limit(1);
  return {
    ...quoteCreatorPlatformFee(grossAmount, policy?.platformFeeBps ?? KRYV_PLATFORM_FEE_BPS),
    feePolicyId: policy?.id ?? null,
    feePolicyVersion: policy?.version ?? null,
  };
}

async function assertChannelExists(channelId: number) {
  const [channel] = await db.select({ id: channelsTable.id, slug: channelsTable.slug, displayName: channelsTable.displayName }).from(channelsTable).where(eq(channelsTable.id, channelId));
  return channel ?? null;
}

async function createCryptoCheckout(input: {
  userId: number;
  channelId: number;
  channelName: string;
  channelSlug: string;
  paymentKind: "subscription" | "tip";
  sourceAmountUsd: string;
  cryptoCurrency?: KryvCryptoCode;
  metadata: Record<string, unknown>;
}) {
  if (!isPlisioConfigured()) throw new PlisioNotConfiguredError();
  await assertCryptoCommerceEnabled();

  const orderNumber = `kryv_${input.paymentKind}_${input.userId}_${crypto.randomUUID()}`;
  const [intent] = await db
    .insert(paymentIntentsTable)
    .values({
      orderNumber,
      purchaserUserId: input.userId,
      receiverChannelId: input.channelId,
      paymentKind: input.paymentKind,
      provider: "plisio",
      sourceAmount: input.sourceAmountUsd,
      sourceCurrency: "USD",
      selectedCurrency: input.cryptoCurrency ?? null,
      status: "creating",
      metadata: input.metadata,
    })
    .returning();

  if (!intent) throw new Error("Unable to initialize crypto checkout.");

  try {
    const invoice = await createPlisioInvoice({
      orderNumber,
      orderName: `Kryv ${input.paymentKind} · ${input.channelName}`,
      sourceAmountUsd: input.sourceAmountUsd,
      currency: input.cryptoCurrency,
      description: input.paymentKind === "subscription" ? `Kryv channel subscription for ${input.channelName}` : `Kryv creator tip for ${input.channelName}`,
      successPath: `/live/${encodeURIComponent(input.channelSlug)}?payment=confirmed`,
      failurePath: `/live/${encodeURIComponent(input.channelSlug)}?payment=cancelled`,
    });

    await db
      .update(paymentIntentsTable)
      .set({
        providerPaymentId: invoice.transactionId,
        selectedCurrency: invoice.selectedCurrency,
        status: "pending",
        expiresAt: invoice.expiresAt,
        metadata: {
          ...input.metadata,
          checkout: {
            providerPaymentId: invoice.transactionId,
            selectedCurrency: invoice.selectedCurrency,
            invoiceAmount: invoice.invoiceAmount,
            invoiceCommission: invoice.invoiceCommission,
            invoiceTotal: invoice.invoiceTotal,
            providerFeePaidBy: "client",
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(paymentIntentsTable.id, intent.id));

    return SubscribeResponse.parse({
      paymentIntentId: intent.id,
      invoiceUrl: invoice.invoiceUrl,
      provider: "plisio",
      status: "pending",
      selectedCurrency: invoice.selectedCurrency,
      expiresAt: invoice.expiresAt,
      paymentAddress: invoice.paymentAddress,
      qrCodeDataUrl: invoice.qrCodeDataUrl,
      invoiceAmount: invoice.invoiceAmount,
      invoiceCommission: invoice.invoiceCommission,
      invoiceTotal: invoice.invoiceTotal,
      providerFeePaidBy: "client",
    });
  } catch (error) {
    await db
      .update(paymentIntentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentIntentsTable.id, intent.id));
    throw error;
  }
}

async function settleCustomerWalletTip(input: {
  userId: number;
  channelId: number;
  currency: KryvCryptoCode;
  amount: string;
  message: string | null;
}) {
  return db.transaction(async (txn) => {
    await txn.execute(sql`SELECT id FROM customer_wallet_balances WHERE user_id = ${input.userId} AND currency = ${input.currency} FOR UPDATE`);
    const [walletBalance] = await txn
      .select()
      .from(customerWalletBalancesTable)
      .where(and(eq(customerWalletBalancesTable.userId, input.userId), eq(customerWalletBalancesTable.currency, input.currency)))
      .limit(1);
    if (!walletBalance || compareCryptoAmounts(String(walletBalance.availableAmount), input.amount) < 0) {
      throw new WalletPaymentError("Your confirmed Kryv Wallet balance is insufficient for this support payment.");
    }

    const allocation = await quoteWalletTipFee(txn, input.amount);
    const now = new Date();
    const [intent] = await txn
      .insert(paymentIntentsTable)
      .values({
        orderNumber: `kryv_wallet_tip_${input.userId}_${crypto.randomUUID()}`,
        purchaserUserId: input.userId,
        receiverChannelId: input.channelId,
        paymentKind: "tip",
        provider: "internal_wallet",
        sourceAmount: input.amount,
        sourceCurrency: input.currency,
        selectedCurrency: input.currency,
        status: "completed",
        completedAt: now,
        metadata: { fundingSource: "customer_wallet", currency: input.currency, message: input.message },
      })
      .returning();
    if (!intent) throw new Error("Kryv could not create the wallet-payment record.");

    const [tip] = await txn
      .insert(tipsTable)
      .values({
        senderUserId: input.userId,
        receiverChannelId: input.channelId,
        amount: input.amount,
        currency: input.currency,
        provider: "internal_wallet",
        providerPaymentIntentId: String(intent.id),
        platformFeeAmount: allocation.platformFeeAmount,
        status: "completed",
        message: input.message,
      })
      .returning();
    if (!tip) throw new Error("Kryv could not record the completed wallet tip.");

    const metadata = {
      fundingSource: "customer_wallet",
      paymentIntentId: intent.id,
      tipId: tip.id,
      grossAmount: allocation.grossAmount,
      platformFeeAmount: allocation.platformFeeAmount,
      creatorNetAmount: allocation.creatorNetAmount,
      platformFeeBps: allocation.platformFeeBps,
      feePolicyId: allocation.feePolicyId,
      feePolicyVersion: allocation.feePolicyVersion,
    };
    await txn
      .insert(customerWalletMovementsTable)
      .values({
        userId: input.userId,
        currency: input.currency,
        movementType: "wallet_tip_debit",
        availableDelta: `-${input.amount}`,
        heldDelta: "0",
        pendingDelta: "0",
        sourceType: "wallet_tip",
        sourceId: String(tip.id),
        idempotencyKey: `wallet-tip-debit:${intent.id}`,
        metadata,
      });
    await txn
      .update(customerWalletBalancesTable)
      .set({ availableAmount: sql`${customerWalletBalancesTable.availableAmount} - ${input.amount}`, updatedAt: now })
      .where(eq(customerWalletBalancesTable.id, walletBalance.id));

    await txn.insert(creatorBalanceMovementsTable).values({
      channelId: input.channelId,
      currency: input.currency,
      movementType: "tip_gross_settled",
      availableDelta: allocation.grossAmount,
      heldDelta: "0",
      pendingDelta: "0",
      sourceType: "wallet_tip",
      sourceId: String(tip.id),
      idempotencyKey: `wallet-tip-gross-credit:${intent.id}`,
      metadata,
    });
    await txn.insert(platformRevenueMovementsTable).values({
      channelId: input.channelId,
      currency: input.currency,
      paymentKind: "tip",
      grossAmount: allocation.grossAmount,
      platformFeeAmount: allocation.platformFeeAmount,
      creatorNetAmount: allocation.creatorNetAmount,
      feePolicyId: allocation.feePolicyId,
      sourceType: "wallet_tip",
      sourceId: String(tip.id),
      idempotencyKey: `wallet-tip-platform-fee:${intent.id}`,
      metadata,
    });
    if (allocation.platformFeeAmount !== "0") {
      await txn.insert(creatorBalanceMovementsTable).values({
        channelId: input.channelId,
        currency: input.currency,
        movementType: "platform_fee_withheld",
        availableDelta: `-${allocation.platformFeeAmount}`,
        heldDelta: "0",
        pendingDelta: "0",
        sourceType: "wallet_tip",
        sourceId: String(tip.id),
        idempotencyKey: `wallet-tip-platform-fee-debit:${intent.id}`,
        metadata,
      });
    }
    await txn
      .insert(creatorBalancesTable)
      .values({ channelId: input.channelId, currency: input.currency, availableAmount: allocation.creatorNetAmount })
      .onConflictDoUpdate({
        target: [creatorBalancesTable.channelId, creatorBalancesTable.currency],
        set: { availableAmount: sql`${creatorBalancesTable.availableAmount} + ${allocation.creatorNetAmount}`, updatedAt: now },
      });
    return { intent, tip, allocation };
  });
}

// GET /emotes - List global emotes
router.get("/emotes", async (_req, res) => {
  const emotes = await db.select().from(emotesTable).where(eq(emotesTable.isGlobal, true));
  res.json(ListEmotesResponse.parse(emotes));
});

// GET /channels/:id/emotes - List channel emotes
router.get("/channels/:id/emotes", async (req, res) => {
  const channelId = Number(req.params.id);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  const emotes = await db.select().from(emotesTable).where(eq(emotesTable.channelId, channelId));
  res.json(ListEmotesResponse.parse(emotes));
});

// POST /channels/:id/subscribe - starts, but never grants, a crypto checkout.
router.post("/channels/:id/subscribe", requireCryptoCommerceReadiness, requireAuth, async (req, res) => {
  const channelId = Number(req.params.id);
  const parsed = SubscribeBody.safeParse(req.body);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const channel = await assertChannelExists(channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  try {
    const amount = configuredSubscriptionAmount(parsed.data.tier);
    const checkout = await createCryptoCheckout({
      userId: req.user!.userId,
      channelId,
      channelName: channel.displayName,
      channelSlug: channel.slug,
      paymentKind: "subscription",
      sourceAmountUsd: amount,
      cryptoCurrency: parsed.data.cryptoCurrency,
      metadata: { tier: parsed.data.tier },
    });
    logActivity(req, "subscription_checkout_started", { channelId, tier: parsed.data.tier, paymentIntentId: checkout.paymentIntentId }).catch(console.error);
    res.status(201).json(SubscribeResponse.parse(checkout));
  } catch (error) {
    if (error instanceof PlisioNotConfiguredError || error instanceof CryptoCommerceDisabledError) return res.status(503).json({ error: error.message });
    console.error("Crypto subscription checkout creation failed", error);
    res.status(502).json({ error: "Crypto checkout could not be started. Please try again." });
  }
});

// POST /channels/:id/tip - starts, but never settles, a crypto creator tip.
router.post("/channels/:id/wallet-tip", requireAuth, async (req, res) => {
  const channelId = Number(req.params.id);
  const parsed = CreateWalletTipBody.safeParse(req.body);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    await assertCryptoCommerceEnabled();
    await assertCustomerWalletCustodyEnabled();
    const channel = await assertChannelExists(channelId);
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    const amount = normalizeCryptoAmount(parsed.data.amount);
    if (compareCryptoAmounts(amount, "0") <= 0) return res.status(400).json({ error: "Wallet support amount must be greater than zero." });
    const settlement = await settleCustomerWalletTip({
      userId: req.user!.userId,
      channelId,
      currency: parsed.data.currency,
      amount,
      message: parsed.data.message?.trim() || null,
    });
    logActivity(req, "wallet_tip_completed", { channelId, currency: parsed.data.currency, amount, paymentIntentId: settlement.intent.id, tipId: settlement.tip.id }).catch(console.error);
    res.status(201).json(CreateWalletTipResponse.parse({
      paymentIntentId: settlement.intent.id,
      tipId: settlement.tip.id,
      currency: parsed.data.currency,
      grossAmount: settlement.allocation.grossAmount,
      platformFeeAmount: settlement.allocation.platformFeeAmount,
      creatorNetAmount: settlement.allocation.creatorNetAmount,
      status: "completed",
    }));
  } catch (error) {
    if (error instanceof WalletPaymentError) return res.status(error.status).json({ error: error.message });
    if (error instanceof CryptoCommerceDisabledError) return res.status(403).json({ error: error.message });
    console.error("Wallet tip settlement failed", error);
    res.status(500).json({ error: "Kryv could not complete this wallet support payment." });
  }
});

router.post("/channels/:id/tip", requireCryptoCommerceReadiness, requireAuth, async (req, res) => {
  const channelId = Number(req.params.id);
  const parsed = TipBody.safeParse(req.body);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const channel = await assertChannelExists(channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  try {
    const checkout = await createCryptoCheckout({
      userId: req.user!.userId,
      channelId,
      channelName: channel.displayName,
      channelSlug: channel.slug,
      paymentKind: "tip",
      sourceAmountUsd: parsed.data.amount.toFixed(2),
      cryptoCurrency: parsed.data.cryptoCurrency,
      metadata: { message: parsed.data.message?.trim() || null },
    });
    logActivity(req, "tip_checkout_started", { channelId, amount: parsed.data.amount, paymentIntentId: checkout.paymentIntentId }).catch(console.error);
    res.status(201).json(TipResponse.parse(checkout));
  } catch (error) {
    if (error instanceof PlisioNotConfiguredError || error instanceof CryptoCommerceDisabledError) return res.status(503).json({ error: error.message });
    console.error("Crypto tip checkout creation failed", error);
    res.status(502).json({ error: "Crypto checkout could not be started. Please try again." });
  }
});

export default router;

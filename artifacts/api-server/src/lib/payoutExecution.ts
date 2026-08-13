import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  creatorBalanceMovementsTable,
  creatorBalancesTable,
  creatorPayoutProfilesTable,
  db,
  featureFlagsTable,
  payoutRequestsTable,
} from "@workspace/db";
import { compareCryptoAmounts, normalizeCryptoAmount } from "./creatorFees";
import {
  createPlisioWithdrawal,
  estimatePlisioWithdrawalFee,
  isSupportedKryvCryptoCode,
  type KryvCryptoCode,
} from "./plisio";
import { logger } from "./logger";

// Provider withdrawal execution is intentionally hard-disabled until the required
// production authorization, egress, reconciliation, and incident controls ship.
// A database flag or environment variable must never override this launch gate.
const PROVIDER_WITHDRAWALS_RUNTIME_ENABLED = false;

export class NonRetryablePayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryablePayoutError";
  }
}

function getPayoutEncryptionKey() {
  const configured = process.env.CREATOR_PAYOUT_ENCRYPTION_KEY?.trim();
  if (!configured) throw new NonRetryablePayoutError("Creator payout encryption is not configured");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new NonRetryablePayoutError("Creator payout encryption key is invalid");
  return key;
}

function decryptPayoutDestination(profile: {
  addressCiphertext: string;
  addressIv: string;
  addressAuthTag: string;
  addressDigest: string;
}) {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getPayoutEncryptionKey(),
      Buffer.from(profile.addressIv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(profile.addressAuthTag, "base64"));
    const destination = Buffer.concat([
      decipher.update(Buffer.from(profile.addressCiphertext, "base64")),
      decipher.final(),
    ]).toString("utf8").trim();
    const digest = crypto.createHash("sha256").update(destination).digest("hex");
    if (
      !destination
      || destination.length < 10
      || destination.length > 256
      || /[\s,]/.test(destination)
      || !crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(profile.addressDigest, "hex"))
    ) {
      throw new Error("Payout destination integrity validation failed");
    }
    return destination;
  } catch (error) {
    if (error instanceof NonRetryablePayoutError) throw error;
    throw new NonRetryablePayoutError("Encrypted payout destination could not be verified");
  }
}

async function isFeatureEnabled(key: string) {
  const [flag] = await db
    .select({ enabled: featureFlagsTable.enabled })
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, key))
    .limit(1);
  return Boolean(flag?.enabled);
}

async function claimApprovedPayoutExecution(payoutRequestId: number) {
  await db.transaction(async (txn) => {
    await txn.execute(sql`SELECT id FROM payout_requests WHERE id = ${payoutRequestId} FOR UPDATE`);
    const [current] = await txn
      .select({ status: payoutRequestsTable.status, providerPayoutId: payoutRequestsTable.providerPayoutId })
      .from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutRequestId))
      .limit(1);
    if (!current) throw new NonRetryablePayoutError("Payout request no longer exists during execution claim");
    if (current.providerPayoutId) {
      throw new NonRetryablePayoutError("Payout request already has a provider operation");
    }
    if (current.status !== "approved") {
      throw new NonRetryablePayoutError(`Payout request is not available for execution (status: ${current.status})`);
    }
    await txn
      .update(payoutRequestsTable)
      .set({ status: "executing", riskHoldReason: null })
      .where(eq(payoutRequestsTable.id, payoutRequestId));
  });
}

export type PayoutExecutionResult = {
  payoutRequestId: number;
  providerPayoutId: string;
  providerStatus: string;
  status: "submitted" | "completed";
};

/**
 * Executes a payout only after an owner has independently approved the request.
 * The database claim transitions approved -> executing before the provider call, so
 * any ambiguous network failure stays held for reconciliation rather than retrying
 * an irreversible transfer blindly.
 */
export async function executeOwnerApprovedPayout(payoutRequestId: number): Promise<PayoutExecutionResult> {
  if (!Number.isSafeInteger(payoutRequestId) || payoutRequestId <= 0) {
    throw new NonRetryablePayoutError("Payout request has an invalid identifier");
  }
  if (!await isFeatureEnabled("provider_withdrawals")) {
    throw new NonRetryablePayoutError("Provider withdrawal execution is disabled by feature flag");
  }
  if (!PROVIDER_WITHDRAWALS_RUNTIME_ENABLED) {
    throw new NonRetryablePayoutError("Provider withdrawal execution is disabled by the production launch gate");
  }

  const [payout] = await db
    .select({
      id: payoutRequestsTable.id,
      channelId: payoutRequestsTable.channelId,
      currency: payoutRequestsTable.currency,
      amount: payoutRequestsTable.amount,
      payoutProfileId: payoutRequestsTable.payoutProfileId,
      providerPayoutId: payoutRequestsTable.providerPayoutId,
      status: payoutRequestsTable.status,
      addressCiphertext: creatorPayoutProfilesTable.addressCiphertext,
      addressIv: creatorPayoutProfilesTable.addressIv,
      addressAuthTag: creatorPayoutProfilesTable.addressAuthTag,
      addressDigest: creatorPayoutProfilesTable.addressDigest,
      profileCurrency: creatorPayoutProfilesTable.currency,
      confirmationStatus: creatorPayoutProfilesTable.confirmationStatus,
      reviewStatus: creatorPayoutProfilesTable.reviewStatus,
    })
    .from(payoutRequestsTable)
    .leftJoin(creatorPayoutProfilesTable, eq(payoutRequestsTable.payoutProfileId, creatorPayoutProfilesTable.id))
    .where(eq(payoutRequestsTable.id, payoutRequestId))
    .limit(1);

  if (!payout) throw new NonRetryablePayoutError("Payout request no longer exists");
  if (["submitted", "completed"].includes(payout.status) && payout.providerPayoutId) {
    return {
      payoutRequestId,
      providerPayoutId: payout.providerPayoutId,
      providerStatus: payout.status,
      status: payout.status as "submitted" | "completed",
    };
  }
  if (payout.status !== "approved") throw new NonRetryablePayoutError(`Payout request is not approved for execution (status: ${payout.status})`);
  if (!payout.payoutProfileId || !payout.addressCiphertext || !payout.addressIv || !payout.addressAuthTag || !payout.addressDigest) {
    throw new NonRetryablePayoutError("Approved payout request has no encrypted destination profile");
  }
  if (payout.confirmationStatus !== "confirmed" || payout.reviewStatus !== "approved") {
    throw new NonRetryablePayoutError("Payout destination has not completed required confirmation and owner review");
  }
  if (!isSupportedKryvCryptoCode(payout.currency) || payout.profileCurrency !== payout.currency) {
    throw new NonRetryablePayoutError("Payout currency does not match the approved payout destination");
  }

  const currency = payout.currency as KryvCryptoCode;
  const amount = normalizeCryptoAmount(String(payout.amount));
  const destination = decryptPayoutDestination({
    addressCiphertext: payout.addressCiphertext,
    addressIv: payout.addressIv,
    addressAuthTag: payout.addressAuthTag,
    addressDigest: payout.addressDigest,
  });
  let executionClaimed = false;
  try {
    const feeEstimate = await estimatePlisioWithdrawalFee({ currency, destination, amount, feePlan: "normal" });
    await claimApprovedPayoutExecution(payoutRequestId);
    executionClaimed = true;
    const providerPayout = await createPlisioWithdrawal({ currency, destination, amount, feePlan: feeEstimate.feePlan });
  if (compareCryptoAmounts(amount, providerPayout.amount) !== 0) {
    throw new Error("Provider payout amount does not match the owner-approved crypto amount");
  }

  const providerStatus = providerPayout.status.toLowerCase();
  const completed = providerStatus === "completed";
  const settledAt = new Date();
  await db.transaction(async (txn) => {
    await txn.execute(sql`SELECT id FROM payout_requests WHERE id = ${payoutRequestId} FOR UPDATE`);
    const [current] = await txn
      .select()
      .from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutRequestId))
      .limit(1);
    if (!current) throw new NonRetryablePayoutError("Payout request no longer exists during settlement");
    if (current.providerPayoutId) {
      if (current.providerPayoutId !== providerPayout.providerPayoutId) {
        throw new NonRetryablePayoutError("Payout request already has a different provider operation");
      }
      return;
    }
    if (current.status !== "executing") {
      throw new NonRetryablePayoutError("Payout request changed state before provider settlement");
    }

    await txn.execute(sql`SELECT id FROM creator_balances WHERE channel_id = ${current.channelId} AND currency = ${currency} FOR UPDATE`);
    const [balance] = await txn
      .select()
      .from(creatorBalancesTable)
      .where(and(eq(creatorBalancesTable.channelId, current.channelId), eq(creatorBalancesTable.currency, currency)))
      .limit(1);
    if (!balance || compareCryptoAmounts(String(balance.heldAmount), amount) < 0) {
      throw new NonRetryablePayoutError("Creator held balance cannot cover the approved payout");
    }

    await txn
      .update(payoutRequestsTable)
      .set({
        status: completed ? "completed" : "submitted",
        provider: "plisio",
        providerPayoutId: providerPayout.providerPayoutId,
        providerTransactionUrl: providerPayout.transactionUrl,
        feeAmount: providerPayout.feeAmount ?? feeEstimate.networkFee,
        feeCurrency: currency,
        feeQuotedAt: settledAt,
        completedAt: completed ? settledAt : null,
        riskHoldReason: null,
      })
      .where(eq(payoutRequestsTable.id, current.id));
    await txn
      .update(creatorBalancesTable)
      .set({
        heldAmount: sql`${creatorBalancesTable.heldAmount} - ${amount}`,
        updatedAt: settledAt,
      })
      .where(eq(creatorBalancesTable.id, balance.id));
    await txn.insert(creatorBalanceMovementsTable).values({
      channelId: current.channelId,
      currency,
      movementType: completed ? "payout_completed" : "payout_submitted",
      availableDelta: "0",
      heldDelta: `-${amount}`,
      pendingDelta: "0",
      sourceType: "payout_request",
      sourceId: String(current.id),
      idempotencyKey: `payout-provider:${current.id}:${providerPayout.providerPayoutId}`,
      metadata: {
        provider: "plisio",
        providerPayoutId: providerPayout.providerPayoutId,
        providerStatus,
        providerFeeAmount: providerPayout.feeAmount,
        estimatedNetworkFee: feeEstimate.networkFee,
        estimatedProviderCommission: feeEstimate.providerCommission,
        feePlan: feeEstimate.feePlan,
        providerTransactionUrl: providerPayout.transactionUrl,
      },
    });
  });

    logger.info({ payoutRequestId, providerPayoutId: providerPayout.providerPayoutId, providerStatus }, "Kryv payout provider operation recorded");
    return {
      payoutRequestId,
      providerPayoutId: providerPayout.providerPayoutId,
      providerStatus,
      status: completed ? "completed" : "submitted",
    };
  } catch (error) {
    // Once the request is claimed, a network or persistence failure can be ambiguous:
    // the provider may have accepted the withdrawal even if Kryv cannot record it.
    // Preserve the executing claim, surface a durable reconciliation instruction, and
    // never turn this path into an automatic retry.
    if (executionClaimed) {
      await db
        .update(payoutRequestsTable)
        .set({ riskHoldReason: "Provider payout outcome requires manual reconciliation. Do not retry or reapprove this request until the provider operation is conclusively resolved." })
        .where(and(eq(payoutRequestsTable.id, payoutRequestId), eq(payoutRequestsTable.status, "executing")));
      logger.error({ payoutRequestId, err: error }, "Kryv payout requires manual provider reconciliation after execution claim");
    }
    throw error;
  }
}

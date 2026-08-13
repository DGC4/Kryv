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
import {
  closeDurableQueue,
  deadLetterDurableJob,
  dequeueDurableJob,
  retryDurableJob,
  type KryvDurableJob,
} from "./lib/jobs";
import { compareCryptoAmounts, normalizeCryptoAmount } from "./lib/creatorFees";
import {
  createPlisioWithdrawal,
  estimatePlisioWithdrawalFee,
  isSupportedKryvCryptoCode,
  type KryvCryptoCode,
} from "./lib/plisio";
import { logger } from "./lib/logger";

let stopping = false;

class NonRetryableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableJobError";
  }
}

function timingSafeSignature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function positivePayoutRequestId(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getPayoutEncryptionKey() {
  const configured = process.env.CREATOR_PAYOUT_ENCRYPTION_KEY?.trim();
  if (!configured) throw new NonRetryableJobError("Creator payout encryption is not configured");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new NonRetryableJobError("Creator payout encryption key is invalid");
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
    if (error instanceof NonRetryableJobError) throw error;
    throw new NonRetryableJobError("Encrypted payout destination could not be verified");
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
    if (!current) throw new NonRetryableJobError("Payout request no longer exists during execution claim");
    if (current.providerPayoutId) {
      throw new NonRetryableJobError("Payout request already has a provider operation");
    }
    if (current.status !== "approved") {
      throw new NonRetryableJobError(`Payout request is not available for execution (status: ${current.status})`);
    }
    await txn
      .update(payoutRequestsTable)
      .set({ status: "executing", riskHoldReason: null })
      .where(eq(payoutRequestsTable.id, payoutRequestId));
  });
}

async function deliverAnalyticsEvent(job: KryvDurableJob) {
  const endpoint = process.env.KRYV_ANALYTICS_WEBHOOK_URL?.trim();
  const secret = process.env.KRYV_ANALYTICS_WEBHOOK_SECRET?.trim();
  if (!endpoint || !secret) {
    logger.debug({ jobId: job.id, type: job.type }, "Analytics sink is not configured; event delivery skipped");
    return;
  }

  const body = JSON.stringify({ id: job.id, occurredAt: job.occurredAt, payload: job.payload });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kryv-event-type": job.type,
      "x-kryv-event-signature": timingSafeSignature(body, secret),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Analytics sink returned HTTP ${response.status}`);
}

async function executePayoutRequest(job: KryvDurableJob) {
  const payoutRequestId = positivePayoutRequestId(job.payload.payoutRequestId);
  if (!payoutRequestId) throw new NonRetryableJobError("Payout job has an invalid payout request identifier");
  if (!await isFeatureEnabled("provider_withdrawals")) {
    throw new NonRetryableJobError("Provider withdrawal execution is disabled by feature flag");
  }
  if (process.env.PLISIO_WITHDRAWALS_ENABLED !== "true") {
    throw new NonRetryableJobError("Provider withdrawal execution is disabled by runtime configuration");
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

  if (!payout) throw new NonRetryableJobError("Payout request no longer exists");
  if (["submitted", "completed"].includes(payout.status) && payout.providerPayoutId) {
    logger.info({ payoutRequestId, providerPayoutId: payout.providerPayoutId }, "Payout job already has a provider operation");
    return;
  }
  if (payout.status !== "approved") throw new NonRetryableJobError(`Payout request is not approved for execution (status: ${payout.status})`);
  if (!payout.payoutProfileId || !payout.addressCiphertext || !payout.addressIv || !payout.addressAuthTag || !payout.addressDigest) {
    throw new NonRetryableJobError("Approved payout request has no encrypted destination profile");
  }
  if (payout.confirmationStatus !== "confirmed" || payout.reviewStatus !== "approved") {
    throw new NonRetryableJobError("Payout destination has not completed required confirmation and owner review");
  }
  if (!isSupportedKryvCryptoCode(payout.currency) || payout.profileCurrency !== payout.currency) {
    throw new NonRetryableJobError("Payout currency does not match the approved payout destination");
  }

  const currency = payout.currency as KryvCryptoCode;
  const amount = normalizeCryptoAmount(String(payout.amount));
  const destination = decryptPayoutDestination({
    addressCiphertext: payout.addressCiphertext,
    addressIv: payout.addressIv,
    addressAuthTag: payout.addressAuthTag,
    addressDigest: payout.addressDigest,
  });
  const feeEstimate = await estimatePlisioWithdrawalFee({ currency, destination, amount, feePlan: "normal" });
  // Claim the request before the irreversible provider call. Any retry after this point
  // finds `executing` and dead-letters for manual reconciliation instead of duplicating
  // an on-chain transfer when a network response is ambiguous.
  await claimApprovedPayoutExecution(payoutRequestId);
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
    if (!current) throw new NonRetryableJobError("Payout request no longer exists during settlement");
    if (current.providerPayoutId) {
      if (current.providerPayoutId !== providerPayout.providerPayoutId) {
        throw new NonRetryableJobError("Payout request already has a different provider operation");
      }
      return;
    }
    if (current.status !== "executing") {
      throw new NonRetryableJobError("Payout request changed state before provider settlement");
    }

    await txn.execute(sql`SELECT id FROM creator_balances WHERE channel_id = ${current.channelId} AND currency = ${currency} FOR UPDATE`);
    const [balance] = await txn
      .select()
      .from(creatorBalancesTable)
      .where(and(eq(creatorBalancesTable.channelId, current.channelId), eq(creatorBalancesTable.currency, currency)))
      .limit(1);
    if (!balance || compareCryptoAmounts(String(balance.heldAmount), amount) < 0) {
      throw new NonRetryableJobError("Creator held balance cannot cover the approved payout");
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
}

async function processJob(job: KryvDurableJob) {
  if (job.type === "analytics.event") {
    await deliverAnalyticsEvent(job);
    return;
  }
  if (job.type === "payout.request") {
    await executePayoutRequest(job);
    return;
  }
  throw new NonRetryableJobError("Worker received an unsupported job type");
}

async function handleFailedJob(job: KryvDurableJob, error: unknown) {
  if (error instanceof NonRetryableJobError) {
    const deadLettered = await deadLetterDurableJob(job, "non_retryable_job", error);
    logger.warn(
      { error, jobId: job.id, type: job.type, deadLettered },
      "Kryv worker blocked a non-retryable job and preserved it in the dead-letter queue",
    );
    return;
  }

  const retryOutcome = await retryDurableJob(job, error);
  logger.error(
    { error, jobId: job.id, type: job.type, attempt: job.attempt, maxAttempts: job.maxAttempts, retryOutcome },
    "Kryv worker job failed",
  );
}

async function run() {
  logger.info("Kryv worker started");
  while (!stopping) {
    const job = await dequeueDurableJob();
    if (!job) continue;
    try {
      await processJob(job);
    } catch (error) {
      await handleFailedJob(job, error);
    }
  }
}

async function shutdown(signal: string) {
  stopping = true;
  logger.info({ signal }, "Stopping Kryv worker");
  await closeDurableQueue();
  process.exit(0);
}

process.once("SIGTERM", () => { shutdown("SIGTERM").catch(() => process.exit(1)); });
process.once("SIGINT", () => { shutdown("SIGINT").catch(() => process.exit(1)); });

run().catch((error) => {
  logger.fatal({ error }, "Kryv worker failed during startup");
  process.exit(1);
});

import crypto from "node:crypto";
import {
  closeDurableQueue,
  deadLetterDurableJob,
  dequeueDurableJob,
  retryDurableJob,
  type KryvDurableJob,
} from "./lib/jobs";
import { logger } from "./lib/logger";
import { executeOwnerApprovedPayout, NonRetryablePayoutError } from "./lib/payoutExecution";

let stopping = false;

function timingSafeSignature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function positivePayoutRequestId(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
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

async function processJob(job: KryvDurableJob) {
  if (job.type === "analytics.event") {
    await deliverAnalyticsEvent(job);
    return;
  }
  if (job.type === "payout.request") {
    const payoutRequestId = positivePayoutRequestId(job.payload.payoutRequestId);
    if (!payoutRequestId) throw new NonRetryablePayoutError("Payout job has an invalid payout request identifier");
    await executeOwnerApprovedPayout(payoutRequestId);
    return;
  }
  throw new NonRetryablePayoutError("Worker received an unsupported job type");
}

async function handleFailedJob(job: KryvDurableJob, error: unknown) {
  if (error instanceof NonRetryablePayoutError) {
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

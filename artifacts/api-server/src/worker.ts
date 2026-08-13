import crypto from "node:crypto";
import {
  closeDurableQueue,
  deadLetterDurableJob,
  dequeueDurableJob,
  retryDurableJob,
  type KryvDurableJob,
} from "./lib/jobs";
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

  // Provider withdrawals are deliberately not executed here until the feature flag,
  // encrypted destination flow, provider allowlist, owner runbook, and test payout
  // gates documented in Kryv_plisio_payout_worker_activation.md are all complete.
  throw new NonRetryableJobError("Payout worker execution remains disabled by production activation gates");
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

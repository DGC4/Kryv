import crypto from "node:crypto";
import { closeDurableQueue, dequeueDurableJob, type KryvDurableJob } from "./lib/jobs";
import { logger } from "./lib/logger";

let stopping = false;

function timingSafeSignature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverAnalyticsEvent(job: KryvDurableJob) {
  const endpoint = process.env.KRYV_ANALYTICS_WEBHOOK_URL?.trim();
  const secret = process.env.KRYV_ANALYTICS_WEBHOOK_SECRET?.trim();
  if (!endpoint || !secret) {
    logger.debug({ jobId: job.id, type: job.type }, "Analytics sink is not configured; event retained only in the queue handoff path");
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
  logger.warn({ jobId: job.id }, "Blocked payout worker job because provider withdrawals remain disabled");
}

async function run() {
  logger.info("Kryv worker started");
  while (!stopping) {
    const job = await dequeueDurableJob();
    if (!job) continue;
    try {
      await processJob(job);
    } catch (error) {
      // The current queue foundation intentionally does not auto-retry a failed
      // external side effect. A durable retry/dead-letter policy is added only once
      // an analytics sink and payout activation runbook are configured and tested.
      logger.error({ error, jobId: job.id, type: job.type }, "Kryv worker job failed");
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

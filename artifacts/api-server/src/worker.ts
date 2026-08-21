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
import {
  fanoutFollowedContentNotifications,
  fanoutFollowedLiveNotifications,
  type FollowedContentNotificationInput,
  type FollowedLiveNotificationInput,
} from "./lib/notificationFanout";

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

function boundedRequiredString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function boundedOptionalString(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  return boundedRequiredString(value, maxLength);
}

function notificationFanoutInput(
  payload: Record<string, unknown>,
): FollowedLiveNotificationInput | FollowedContentNotificationInput | null {
  const channelId = positivePayoutRequestId(payload.channelId);
  if (!channelId) return null;

  if (payload.kind === "live") {
    const channelSlug = boundedRequiredString(payload.channelSlug, 120);
    const channelDisplayName = boundedRequiredString(payload.channelDisplayName, 160);
    const streamSessionId = positivePayoutRequestId(payload.streamSessionId);
    const streamTitle = boundedOptionalString(payload.streamTitle, 300);
    if (!channelSlug || !channelDisplayName || !streamSessionId) return null;
    if (payload.streamTitle !== null && payload.streamTitle !== undefined && !streamTitle) {
      return null;
    }
    return {
      channelId,
      channelSlug,
      channelDisplayName,
      streamTitle,
      streamSessionId,
    };
  }

  if (payload.kind === "watch_upload_ready" || payload.kind === "clip_ready") {
    const contentId = positivePayoutRequestId(payload.contentId);
    const contentTitle = boundedRequiredString(payload.contentTitle, 300);
    if (!contentId || !contentTitle) return null;
    return {
      channelId,
      notificationType: payload.kind,
      contentId,
      contentTitle,
    };
  }

  return null;
}

function validatedAnalyticsWebhookUrl(value: string) {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("KRYV_ANALYTICS_WEBHOOK_URL must be a valid absolute URL.");
  }
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new Error("KRYV_ANALYTICS_WEBHOOK_URL must use HTTPS in production.");
  }
  return endpoint.toString();
}

async function deliverAnalyticsEvent(job: KryvDurableJob) {
  const configuredEndpoint = process.env.KRYV_ANALYTICS_WEBHOOK_URL?.trim();
  const secret = process.env.KRYV_ANALYTICS_WEBHOOK_SECRET?.trim();
  if (!configuredEndpoint || !secret) {
    logger.debug({ jobId: job.id, type: job.type }, "Analytics sink is not configured; event delivery skipped");
    return;
  }

  const endpoint = validatedAnalyticsWebhookUrl(configuredEndpoint);
  const body = JSON.stringify({ id: job.id, occurredAt: job.occurredAt, payload: job.payload });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kryv-event-type": job.type,
      "x-kryv-event-signature": timingSafeSignature(body, secret),
    },
    body,
    redirect: "error",
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
    if (!payoutRequestId) {
      throw new NonRetryablePayoutError(
        "Payout job has an invalid payout request identifier",
      );
    }
    await executeOwnerApprovedPayout(payoutRequestId);
    return;
  }
  if (job.type === "notification.fanout") {
    const input = notificationFanoutInput(job.payload);
    if (!input) {
      throw new NonRetryableJobError("Notification fan-out job payload is invalid");
    }
    // Fan-out is explicitly one-shot until receipt-level idempotency exists. A
    // failed batch is preserved in the dead-letter queue for operator review,
    // rather than automatically replaying user-visible alerts.
    if ("streamSessionId" in input) {
      await fanoutFollowedLiveNotifications(input);
    } else {
      await fanoutFollowedContentNotifications(input);
    }
    return;
  }
  throw new NonRetryableJobError("Worker received an unsupported job type");
}

async function handleFailedJob(job: KryvDurableJob, error: unknown) {
  if (
    error instanceof NonRetryablePayoutError ||
    error instanceof NonRetryableJobError
  ) {
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

import Redis from "ioredis";
import { logger } from "./logger";

export const DURABLE_QUEUE_KEY = "kryv:jobs";
export const DURABLE_RETRY_QUEUE_KEY = "kryv:jobs:scheduled";
export const DURABLE_DEAD_LETTER_QUEUE_KEY = "kryv:jobs:dead-letter";
export const DEFAULT_MAX_JOB_ATTEMPTS = 4;

export type KryvDurableJob = {
  id: string;
  type: "analytics.event" | "payout.request";
  occurredAt: string;
  payload: Record<string, unknown>;
  /** Zero for an initial delivery; incremented for every scheduled retry. */
  attempt?: number;
  /** Total processing attempts permitted, including the initial delivery. */
  maxAttempts?: number;
};

export type KryvDeadLetterJob = {
  job: Required<Pick<KryvDurableJob, "id" | "type" | "occurredAt" | "payload">> & {
    attempt: number;
    maxAttempts: number;
  };
  failedAt: string;
  reason: string;
  error: string;
};

export type DurableRetryResult = "scheduled" | "dead-lettered" | "unavailable";

const QUEUE_URL = process.env.KRYV_QUEUE_REDIS_URL?.trim();
const MOVE_DUE_JOBS_LUA = `
local jobs = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
for index, serialized in ipairs(jobs) do
  if redis.call('ZREM', KEYS[1], serialized) == 1 then
    redis.call('LPUSH', KEYS[2], serialized)
  end
end
return #jobs
`;

let queueClient: Redis | null | undefined;

function getQueueClient() {
  if (queueClient !== undefined) return queueClient;
  if (!QUEUE_URL) {
    queueClient = null;
    return queueClient;
  }

  queueClient = new Redis(QUEUE_URL, {
    connectTimeout: 2_500,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt <= 3 ? Math.min(attempt * 250, 1_000) : null),
  });
  queueClient.on("error", (error) => logger.warn({ error }, "Kryv durable job queue is unavailable"));
  return queueClient;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

export function normalizeDurableJob(value: unknown): Required<KryvDurableJob> {
  if (!value || typeof value !== "object") throw new Error("Durable job is not an object");
  const job = value as Partial<KryvDurableJob>;
  if (!job.id || typeof job.id !== "string") throw new Error("Durable job is missing an id");
  if (job.type !== "analytics.event" && job.type !== "payout.request") throw new Error("Durable job has an unsupported type");
  if (!job.occurredAt || typeof job.occurredAt !== "string") throw new Error("Durable job is missing occurredAt");
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) throw new Error("Durable job is missing payload");

  return {
    id: job.id,
    type: job.type,
    occurredAt: job.occurredAt,
    payload: job.payload,
    attempt: boundedInteger(job.attempt, 0, 0, 100),
    maxAttempts: boundedInteger(job.maxAttempts, DEFAULT_MAX_JOB_ATTEMPTS, 1, 10),
  };
}

/** Returns the deterministic delay before the retry number passed in. */
export function retryDelayMs(nextAttempt: number) {
  const boundedAttempt = boundedInteger(nextAttempt, 1, 1, 10);
  return Math.min(1_000 * 2 ** (boundedAttempt - 1), 30_000);
}

function serializeJob(job: KryvDurableJob) {
  return JSON.stringify(normalizeDurableJob(job));
}

async function moveDueJobs(queue: Redis) {
  await queue.eval(
    MOVE_DUE_JOBS_LUA,
    2,
    DURABLE_RETRY_QUEUE_KEY,
    DURABLE_QUEUE_KEY,
    String(Date.now()),
    "100",
  );
}

async function deadLetterRaw(queue: Redis, value: unknown, reason: string, error: unknown) {
  const entry = {
    failedAt: new Date().toISOString(),
    reason,
    error: safeErrorMessage(error),
    raw: typeof value === "string" ? value.slice(0, 8_192) : value,
  };
  await queue.rpush(DURABLE_DEAD_LETTER_QUEUE_KEY, JSON.stringify(entry));
}

export async function enqueueDurableJob(job: KryvDurableJob) {
  const queue = getQueueClient();
  if (!queue) return false;
  try {
    await queue.lpush(DURABLE_QUEUE_KEY, serializeJob(job));
    return true;
  } catch (error) {
    logger.warn({ error, jobId: job.id, type: job.type }, "Kryv durable job enqueue failed");
    return false;
  }
}

export async function dequeueDurableJob(timeoutSeconds = 5): Promise<Required<KryvDurableJob> | null> {
  const queue = getQueueClient();
  if (!queue) return null;
  try {
    await moveDueJobs(queue);
    const value = await queue.brpop(DURABLE_QUEUE_KEY, timeoutSeconds);
    if (!value) return null;

    try {
      return normalizeDurableJob(JSON.parse(value[1]));
    } catch (error) {
      await deadLetterRaw(queue, value[1], "malformed_durable_job", error);
      logger.error({ error }, "Malformed durable job moved to dead-letter queue");
      return null;
    }
  } catch (error) {
    logger.warn({ error }, "Kryv durable job dequeue failed");
    return null;
  }
}

export async function deadLetterDurableJob(job: KryvDurableJob, reason: string, error: unknown): Promise<boolean> {
  const queue = getQueueClient();
  if (!queue) return false;
  try {
    const normalized = normalizeDurableJob(job);
    const entry: KryvDeadLetterJob = {
      job: normalized,
      failedAt: new Date().toISOString(),
      reason,
      error: safeErrorMessage(error),
    };
    await queue.rpush(DURABLE_DEAD_LETTER_QUEUE_KEY, JSON.stringify(entry));
    return true;
  } catch (queueError) {
    logger.error({ queueError, jobId: job.id, type: job.type }, "Kryv durable job dead-letter write failed");
    return false;
  }
}

/**
 * Requeues retryable jobs using exponential backoff or preserves exhausted jobs in
 * the durable dead-letter list. The worker must keep payout jobs non-retryable until
 * their separate activation gates permit provider execution.
 */
export async function retryDurableJob(job: KryvDurableJob, error: unknown): Promise<DurableRetryResult> {
  const queue = getQueueClient();
  if (!queue) return "unavailable";

  try {
    const normalized = normalizeDurableJob(job);
    const nextAttempt = normalized.attempt + 1;
    if (nextAttempt >= normalized.maxAttempts) {
      const deadLettered = await deadLetterDurableJob(normalized, "retry_exhausted", error);
      return deadLettered ? "dead-lettered" : "unavailable";
    }

    const retryJob = { ...normalized, attempt: nextAttempt };
    const retryAt = Date.now() + retryDelayMs(nextAttempt);
    await queue.zadd(DURABLE_RETRY_QUEUE_KEY, retryAt, serializeJob(retryJob));
    return "scheduled";
  } catch (queueError) {
    logger.error({ queueError, jobId: job.id, type: job.type }, "Kryv durable job retry scheduling failed");
    return "unavailable";
  }
}

export async function closeDurableQueue() {
  if (queueClient) await queueClient.quit().catch(() => queueClient?.disconnect());
  queueClient = undefined;
}

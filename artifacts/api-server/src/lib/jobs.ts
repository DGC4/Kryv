import Redis from "ioredis";
import { logger } from "./logger";

export type KryvDurableJob = {
  id: string;
  type: "analytics.event" | "payout.request";
  occurredAt: string;
  payload: Record<string, unknown>;
};

const QUEUE_KEY = "kryv:jobs";
const QUEUE_URL = process.env.KRYV_QUEUE_REDIS_URL?.trim();
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

export async function enqueueDurableJob(job: KryvDurableJob) {
  const queue = getQueueClient();
  if (!queue) return false;
  try {
    await queue.lpush(QUEUE_KEY, JSON.stringify(job));
    return true;
  } catch {
    return false;
  }
}

export async function dequeueDurableJob(timeoutSeconds = 5): Promise<KryvDurableJob | null> {
  const queue = getQueueClient();
  if (!queue) return null;
  try {
    const value = await queue.brpop(QUEUE_KEY, timeoutSeconds);
    if (!value) return null;
    const job = JSON.parse(value[1]) as KryvDurableJob;
    if (!job?.id || !job?.type || !job?.occurredAt || !job.payload) throw new Error("Malformed durable job payload");
    return job;
  } catch (error) {
    logger.warn({ error }, "Kryv durable job dequeue failed");
    return null;
  }
}

export async function closeDurableQueue() {
  if (queueClient) await queueClient.quit().catch(() => queueClient?.disconnect());
  queueClient = undefined;
}

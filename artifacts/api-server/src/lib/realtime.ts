import Redis from "ioredis";
import { logger } from "./logger";

export type KryvRealtimeEvent = {
  type: "chat.message.created" | "chat.message.deleted" | "channel.moderation.updated" | "live.state.updated" | "discover.invalidated";
  channelId: number;
  occurredAt: string;
  data: Record<string, unknown>;
};

const CACHE_URL = process.env.KRYV_CACHE_REDIS_URL?.trim();
let cacheClient: Redis | null | undefined;
let publisherClient: Redis | null | undefined;
let subscriberClient: Redis | null | undefined;

function createRedisClient(role: "cache" | "publisher" | "subscriber") {
  if (!CACHE_URL) return null;

  const client = new Redis(CACHE_URL, {
    connectTimeout: 2_500,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt <= 3 ? Math.min(attempt * 250, 1_000) : null),
  });
  client.on("error", (error) => logger.warn({ error, role }, "Kryv shared state is unavailable; serving the safe database fallback"));
  client.on("end", () => logger.warn({ role }, "Kryv shared state connection ended"));
  return client;
}

export function getSharedStateClient() {
  if (cacheClient === undefined) cacheClient = createRedisClient("cache");
  return cacheClient;
}

export function getRealtimePublisher() {
  if (publisherClient === undefined) publisherClient = createRedisClient("publisher");
  return publisherClient;
}

export function getRealtimeSubscriber() {
  if (subscriberClient === undefined) subscriberClient = createRedisClient("subscriber");
  return subscriberClient;
}

export function realtimeRoom(channelId: number) {
  return `kryv:room:${channelId}`;
}

export async function readSharedJson<T>(key: string): Promise<T | null> {
  const client = getSharedStateClient();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export async function writeSharedJson(key: string, value: unknown, ttlSeconds: number) {
  const client = getSharedStateClient();
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function deleteSharedKey(key: string) {
  const client = getSharedStateClient();
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Event publication never decides balances, stream status, or moderation. It only
 * tells gateway instances to refresh their already-authoritative server state.
 */
export async function publishRealtimeEvent(event: KryvRealtimeEvent) {
  const publisher = getRealtimePublisher();
  if (!publisher) return false;
  try {
    await publisher.publish(realtimeRoom(event.channelId), JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

export async function publishPlatformEvent(event: KryvRealtimeEvent) {
  const publisher = getRealtimePublisher();
  if (!publisher) return false;
  try {
    await publisher.publish("kryv:platform", JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

export async function closeSharedState() {
  const clients = [cacheClient, publisherClient, subscriberClient].filter((client): client is Redis => Boolean(client));
  await Promise.all(clients.map((client) => client.quit().catch(() => client.disconnect())));
  cacheClient = undefined;
  publisherClient = undefined;
  subscriberClient = undefined;
}

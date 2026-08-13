import Redis from "ioredis";
import { logger } from "./logger";

export type KryvRealtimeEvent = {
  type: "chat.message.created" | "chat.message.deleted" | "channel.moderation.updated" | "engagement.updated" | "live.state.updated" | "discover.invalidated";
  channelId: number;
  occurredAt: string;
  data: Record<string, unknown>;
};

const CACHE_URL = process.env.KRYV_CACHE_REDIS_URL?.trim();
let cacheClient: Redis | null | undefined;
let publisherClient: Redis | null | undefined;
let subscriberClient: Redis | null | undefined;

type LocalCacheEntry = { value: string; expiresAt: number };
const localSharedCache = new Map<string, LocalCacheEntry>();
const LOCAL_SHARED_CACHE_LIMIT = 256;

function readLocalCache(key: string) {
  const entry = localSharedCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localSharedCache.delete(key);
    return null;
  }
  // Promote recently used entries while retaining a hard memory bound.
  localSharedCache.delete(key);
  localSharedCache.set(key, entry);
  return entry.value;
}

function writeLocalCache(key: string, value: string, ttlSeconds: number) {
  if (ttlSeconds <= 0) return;
  localSharedCache.delete(key);
  localSharedCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
  while (localSharedCache.size > LOCAL_SHARED_CACHE_LIMIT) {
    const oldestKey = localSharedCache.keys().next().value;
    if (!oldestKey) break;
    localSharedCache.delete(oldestKey);
  }
}

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
  if (!client) {
    const localValue = readLocalCache(key);
    return localValue ? JSON.parse(localValue) as T : null;
  }
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    const localValue = readLocalCache(key);
    return localValue ? JSON.parse(localValue) as T : null;
  }
}

export async function writeSharedJson(key: string, value: unknown, ttlSeconds: number) {
  const serialized = JSON.stringify(value);
  const client = getSharedStateClient();
  if (!client) {
    writeLocalCache(key, serialized, ttlSeconds);
    return true;
  }
  try {
    await client.set(key, serialized, "EX", ttlSeconds);
    return true;
  } catch {
    writeLocalCache(key, serialized, ttlSeconds);
    return true;
  }
}

export async function deleteSharedKey(key: string) {
  localSharedCache.delete(key);
  const client = getSharedStateClient();
  if (!client) return true;
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
  localSharedCache.clear();
}

import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  creatorActivities,
  creatorNotificationPreferences,
  creatorPayouts,
  creatorProfiles,
  creatorStreamSettings,
  InsertUser,
  streamSessions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type CreatorProfileUpdate = {
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  brandColor: string;
};

export type CreatorStreamUpdate = {
  streamTitle: string;
  category?: string;
};

export type CreatorNotificationUpdate = {
  streamAlerts: boolean;
  followerAlerts: boolean;
  revenueAlerts: boolean;
  weeklyDigest: boolean;
};

export type GeneratedStreamKey = {
  plainText: string;
  hash: string;
  preview: string;
};

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;

    textFields.forEach((field) => {
      const value = user[field];
      if (value !== undefined) {
        values[field] = value ?? null;
        updateSet[field] = value ?? null;
      }
    });

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

function channelSlug(displayName: string, userId: number) {
  const normalized = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${normalized || "creator"}-${userId}`;
}

function configuredRtmpServerUrl() {
  return process.env.KRYV_RTMP_SERVER_URL?.trim() || null;
}

export function generateStreamKey(): GeneratedStreamKey {
  const plainText = `kryv_live_${randomBytes(24).toString("base64url")}`;
  return {
    plainText,
    hash: createHash("sha256").update(plainText).digest("hex"),
    preview: `••••${plainText.slice(-6)}`,
  };
}

async function addActivity(userId: number, type: string, message: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(creatorActivities).values({ userId, type, message });
}

export async function ensureCreatorWorkspace(userId: number, fallbackName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Creator dashboard database is unavailable");

  const [existingProfile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, userId)).limit(1);
  if (!existingProfile) {
    const displayName = (fallbackName?.trim() || "Kryv Creator").slice(0, 60);
    await db.insert(creatorProfiles).values({
      userId,
      displayName,
      channelSlug: channelSlug(displayName, userId),
    });
  }

  await db.insert(creatorStreamSettings).values({
    userId,
    rtmpServerUrl: configuredRtmpServerUrl(),
  }).onDuplicateKeyUpdate({
    set: { rtmpServerUrl: configuredRtmpServerUrl(), updatedAt: new Date() },
  });

  await db.insert(creatorNotificationPreferences).values({ userId }).onDuplicateKeyUpdate({
    set: { updatedAt: new Date() },
  });

  const [[profile], [stream], [notifications]] = await Promise.all([
    db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, userId)).limit(1),
    db.select().from(creatorStreamSettings).where(eq(creatorStreamSettings.userId, userId)).limit(1),
    db.select().from(creatorNotificationPreferences).where(eq(creatorNotificationPreferences.userId, userId)).limit(1),
  ]);

  if (!profile || !stream || !notifications) throw new Error("Creator workspace could not be initialized");
  return { profile, stream, notifications };
}

export async function getCreatorDashboard(userId: number, fallbackName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Creator dashboard database is unavailable");
  const workspace = await ensureCreatorWorkspace(userId, fallbackName);

  const [sessions, activities, payouts] = await Promise.all([
    db.select().from(streamSessions).where(eq(streamSessions.userId, userId)).orderBy(desc(streamSessions.startedAt)).limit(30),
    db.select().from(creatorActivities).where(eq(creatorActivities.userId, userId)).orderBy(desc(creatorActivities.occurredAt)).limit(8),
    db.select().from(creatorPayouts).where(eq(creatorPayouts.userId, userId)).orderBy(desc(creatorPayouts.createdAt)).limit(12),
  ]);

  const chronologicalSessions = [...sessions].reverse();
  const followers = sessions.reduce((total, session) => total + session.followerGains, 0);
  const revenueCents = sessions.reduce((total, session) => total + session.revenueCents, 0);
  const peakViewers = sessions.reduce((peak, session) => Math.max(peak, session.peakViewers), 0);
  let cumulativeFollowers = 0;

  return {
    profile: workspace.profile,
    stream: {
      rtmpServerUrl: workspace.stream.rtmpServerUrl,
      streamKeyPreview: workspace.stream.streamKeyPreview,
      hasStreamKey: Boolean(workspace.stream.streamKeyHash),
      streamTitle: workspace.stream.streamTitle,
      category: workspace.stream.category,
      isLive: workspace.stream.isLive,
      lastKeyRotatedAt: workspace.stream.lastKeyRotatedAt,
    },
    notifications: workspace.notifications,
    stats: {
      currentViewers: workspace.stream.isLive ? peakViewers : 0,
      followers,
      revenueCents,
      streamCount: sessions.length,
      peakViewers,
    },
    recentActivity: activities,
    streamHistory: sessions,
    viewerTrend: chronologicalSessions.map((session) => ({
      label: session.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: session.peakViewers,
    })),
    followerGrowth: chronologicalSessions.map((session) => {
      cumulativeFollowers += session.followerGains;
      return {
        label: session.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: cumulativeFollowers,
      };
    }),
    payouts,
  };
}

export async function updateCreatorProfile(userId: number, input: CreatorProfileUpdate, fallbackName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Creator dashboard database is unavailable");
  await ensureCreatorWorkspace(userId, fallbackName);
  await db.update(creatorProfiles).set({
    displayName: input.displayName.trim(),
    bio: input.bio?.trim() || null,
    avatarUrl: input.avatarUrl?.trim() || null,
    brandColor: input.brandColor,
    updatedAt: new Date(),
  }).where(eq(creatorProfiles.userId, userId));
  await addActivity(userId, "profile_updated", "Updated creator profile and channel branding");
  const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, userId)).limit(1);
  return profile;
}

export async function updateCreatorStream(userId: number, input: CreatorStreamUpdate, fallbackName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Creator dashboard database is unavailable");
  await ensureCreatorWorkspace(userId, fallbackName);
  await db.update(creatorStreamSettings).set({
    streamTitle: input.streamTitle.trim(),
    category: input.category?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(creatorStreamSettings.userId, userId));
  await addActivity(userId, "stream_updated", "Updated stream title and category");
}

export async function rotateCreatorStreamKey(userId: number, fallbackName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Creator dashboard database is unavailable");
  await ensureCreatorWorkspace(userId, fallbackName);
  const generated = generateStreamKey();
  const rotatedAt = new Date();
  await db.update(creatorStreamSettings).set({
    streamKeyHash: generated.hash,
    streamKeyPreview: generated.preview,
    lastKeyRotatedAt: rotatedAt,
    updatedAt: rotatedAt,
  }).where(eq(creatorStreamSettings.userId, userId));
  await addActivity(userId, "stream_key_rotated", "Regenerated the stream key");
  return { streamKey: generated.plainText, streamKeyPreview: generated.preview, lastKeyRotatedAt: rotatedAt };
}

export async function updateCreatorNotifications(userId: number, input: CreatorNotificationUpdate, fallbackName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Creator dashboard database is unavailable");
  await ensureCreatorWorkspace(userId, fallbackName);
  await db.update(creatorNotificationPreferences).set({ ...input, updatedAt: new Date() })
    .where(eq(creatorNotificationPreferences.userId, userId));
  await addActivity(userId, "notifications_updated", "Updated creator notification preferences");
  const [preferences] = await db.select().from(creatorNotificationPreferences)
    .where(eq(creatorNotificationPreferences.userId, userId)).limit(1);
  return preferences;
}

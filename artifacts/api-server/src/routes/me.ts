import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  channelsTable,
  db,
  followsTable,
  notificationPreferencesTable,
  notificationsTable,
  userActivityPresenceTable,
  usersTable,
  viewerProfilesTable,
} from "@workspace/db";
import {
  CreateViewerProfileBody,
  CreateViewerProfileResponse,
  DeleteViewerProfileParams,
  GetMeResponse,
  ListViewerProfilesResponse,
  GetActivityObservabilityPreferencesResponse,
  ReportActivityPresenceBody,
  UpdateActivityObservabilityPreferencesBody,
  UpdateActivityObservabilityPreferencesResponse,
  UpdateNotificationPreferencesBody,
  GetNotificationInboxQueryParams,
  GetNotificationInboxResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  UpdateViewerProfileBody,
  UpdateViewerProfileParams,
  UpdateViewerProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";
import { FastPixNotConfiguredError, getFastPixLiveStream } from "../lib/fastpix";

const router: IRouter = Router();
const MAX_VIEWER_PROFILES = 5;

type ViewerProfileRow = typeof viewerProfilesTable.$inferSelect;

function toViewerProfile(profile: ViewerProfileRow) {
  return {
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    maturityLevel: profile.maturityLevel as "kids" | "standard" | "mature",
    isKidsProfile: profile.isKidsProfile,
    isDefault: profile.isDefault,
    createdAt: profile.createdAt,
  };
}

async function listOrCreateDefaultViewerProfiles(userId: number) {
  const profiles = await db
    .select()
    .from(viewerProfilesTable)
    .where(eq(viewerProfilesTable.userId, userId))
    .orderBy(asc(viewerProfilesTable.createdAt));

  if (profiles.length > 0) return profiles;

  const [user] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return [];

  const [created] = await db
    .insert(viewerProfilesTable)
    .values({
      userId,
      name: user.username,
      avatarUrl: user.avatarUrl,
      maturityLevel: "standard",
      isDefault: true,
    })
    .returning();

  return created ? [created] : [];
}

router.get("/me/profiles", requireAuth, async (req, res): Promise<void> => {
  const profiles = await listOrCreateDefaultViewerProfiles(req.user!.userId);
  res.json(ListViewerProfilesResponse.parse(profiles.map(toViewerProfile)));
});

router.post("/me/profiles", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateViewerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const profiles = await listOrCreateDefaultViewerProfiles(userId);
  if (profiles.length >= MAX_VIEWER_PROFILES) {
    res.status(400).json({ error: `You can create up to ${MAX_VIEWER_PROFILES} viewer profiles.` });
    return;
  }

  const isKidsProfile = parsed.data.isKidsProfile ?? false;
  const isDefault = parsed.data.isDefault ?? false;

  const created = await db.transaction(async (tx) => {
    if (isDefault) {
      await tx
        .update(viewerProfilesTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(viewerProfilesTable.userId, userId));
    }

    const [profile] = await tx
      .insert(viewerProfilesTable)
      .values({
        userId,
        name: parsed.data.name.trim(),
        avatarUrl: parsed.data.avatarUrl ?? null,
        maturityLevel: isKidsProfile ? "kids" : (parsed.data.maturityLevel ?? "standard"),
        isKidsProfile,
        isDefault,
      })
      .returning();

    return profile;
  });

  if (!created) {
    res.status(500).json({ error: "Unable to create viewer profile" });
    return;
  }

  res.status(201).json(CreateViewerProfileResponse.parse(toViewerProfile(created)));
});

router.patch("/me/profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateViewerProfileParams.safeParse(req.params);
  const parsed = UpdateViewerProfileBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: !params.success ? params.error.message : parsed.error?.message ?? "Invalid request body" });
    return;
  }

  const userId = req.user!.userId;
  const [existing] = await db
    .select()
    .from(viewerProfilesTable)
    .where(and(eq(viewerProfilesTable.id, params.data.id), eq(viewerProfilesTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Viewer profile not found" });
    return;
  }

  const isKidsProfile = parsed.data.isKidsProfile ?? existing.isKidsProfile;
  const nextMaturityLevel = isKidsProfile ? "kids" : (parsed.data.maturityLevel ?? existing.maturityLevel);
  const updated = await db.transaction(async (tx) => {
    if (parsed.data.isDefault === true) {
      await tx
        .update(viewerProfilesTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(viewerProfilesTable.userId, userId));
    }

    const [profile] = await tx
      .update(viewerProfilesTable)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
        ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
        isKidsProfile,
        maturityLevel: nextMaturityLevel,
        updatedAt: new Date(),
      })
      .where(and(eq(viewerProfilesTable.id, existing.id), eq(viewerProfilesTable.userId, userId)))
      .returning();

    return profile;
  });

  if (!updated) {
    res.status(500).json({ error: "Unable to update viewer profile" });
    return;
  }

  res.json(UpdateViewerProfileResponse.parse(toViewerProfile(updated)));
});

router.delete("/me/profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteViewerProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db
    .select()
    .from(viewerProfilesTable)
    .where(and(eq(viewerProfilesTable.id, params.data.id), eq(viewerProfilesTable.userId, req.user!.userId)));

  if (!profile) {
    res.status(404).json({ error: "Viewer profile not found" });
    return;
  }
  if (profile.isDefault) {
    res.status(400).json({ error: "The default viewer profile cannot be deleted." });
    return;
  }

  await db
    .delete(viewerProfilesTable)
    .where(and(eq(viewerProfilesTable.id, profile.id), eq(viewerProfilesTable.userId, req.user!.userId)));
  res.status(204).end();
});

router.get("/me/notifications", requireAuth, async (req, res): Promise<void> => {
  const query = GetNotificationInboxQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const userId = req.user!.userId;
  const [items, [unread]] = await Promise.all([
    db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(query.data.limit),
    db
      .select({ count: sql<number>`COALESCE(COUNT(*), 0)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))),
  ]);

  res.json(GetNotificationInboxResponse.parse({
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      data: item.data ?? {},
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
    })),
    unreadCount: Number(unread?.count ?? 0),
  }));
});

router.patch("/me/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, params.data.id), eq(notificationsTable.userId, req.user!.userId)))
    .returning();
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(MarkNotificationReadResponse.parse({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data ?? {},
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  }));
});

router.get("/me/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const [preference] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(and(eq(notificationPreferencesTable.userId, req.user!.userId), isNull(notificationPreferencesTable.channelId)))
    .limit(1);

  res.json({
    notifyOnLive: preference?.notifyOnLive ?? true,
    notifyOnUpload: preference?.notifyOnUpload ?? true,
    notifyOnClip: preference?.notifyOnClip ?? false,
    emailNotifications: preference?.emailNotifications ?? false,
  });
});

router.get("/me/activity-observability", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({ enabled: usersTable.activityObservabilityEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  res.json(GetActivityObservabilityPreferencesResponse.parse({ enabled: user?.enabled ?? false }));
});

router.put("/me/activity-observability", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateActivityObservabilityPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const [updated] = await db
    .update(usersTable)
    .set({ activityObservabilityEnabled: parsed.data.enabled })
    .where(eq(usersTable.id, userId))
    .returning({ enabled: usersTable.activityObservabilityEnabled });

  if (!parsed.data.enabled) {
    await db.delete(userActivityPresenceTable).where(eq(userActivityPresenceTable.userId, userId));
  }

  res.json(UpdateActivityObservabilityPreferencesResponse.parse({ enabled: updated?.enabled ?? false }));
});

router.post("/me/activity-presence", requireAuth, async (req, res): Promise<void> => {
  const parsed = ReportActivityPresenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const [user] = await db
    .select({ enabled: usersTable.activityObservabilityEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user?.enabled) {
    res.status(403).json({ error: "Activity visibility is disabled for this account." });
    return;
  }

  const [existing] = await db
    .select({ userId: userActivityPresenceTable.userId })
    .from(userActivityPresenceTable)
    .where(eq(userActivityPresenceTable.userId, userId));
  const values = { routeKey: parsed.data.routeKey, deviceClass: parsed.data.deviceClass, updatedAt: new Date() };

  if (existing) {
    await db.update(userActivityPresenceTable).set(values).where(eq(userActivityPresenceTable.userId, userId));
  } else {
    await db.insert(userActivityPresenceTable).values({ userId, ...values });
  }

  res.status(204).end();
});

router.put("/me/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateNotificationPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.userId;
  const [existing] = await db
    .select({ id: notificationPreferencesTable.id })
    .from(notificationPreferencesTable)
    .where(and(eq(notificationPreferencesTable.userId, userId), isNull(notificationPreferencesTable.channelId)))
    .limit(1);

  const [preference] = existing
    ? await db.update(notificationPreferencesTable).set(parsed.data).where(eq(notificationPreferencesTable.id, existing.id)).returning()
    : await db.insert(notificationPreferencesTable).values({ userId, ...parsed.data }).returning();

  res.json({
    notifyOnLive: preference.notifyOnLive,
    notifyOnUpload: preference.notifyOnUpload,
    notifyOnClip: preference.notifyOnClip,
    emailNotifications: preference.emailNotifications,
  });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let [ownChannel] = await db.select().from(channelsTable).where(eq(channelsTable.ownerUserId, userId));

  // Webhooks remain the primary real-time state source. This short-lived provider
  // reconciliation lets an open Creator Studio recover safely from a delayed or
  // missed delivery without exposing the provider to public viewers.
  if (ownChannel?.fastpixLiveStreamId) {
    try {
      const liveStream = await getFastPixLiveStream(ownChannel.fastpixLiveStreamId);
      const providerStatus = typeof liveStream?.status === "string" ? liveStream.status : null;
      const playbackId = liveStream?.playbackIds?.[0]?.id;
      const expectedIsLive = providerStatus === "active" ? true : ["idle", "disabled"].includes(providerStatus ?? "") ? false : ownChannel.isLive;

      if (expectedIsLive !== ownChannel.isLive || (typeof playbackId === "string" && playbackId !== ownChannel.fastpixPlaybackId)) {
        const [reconciledChannel] = await db
          .update(channelsTable)
          .set({
            isLive: expectedIsLive,
            ...(expectedIsLive && !ownChannel.isLive ? { lastStreamAt: new Date() } : {}),
            ...(typeof playbackId === "string" ? { fastpixPlaybackId: playbackId } : {}),
            ...(!expectedIsLive ? { viewerCount: 0 } : {}),
          })
          .where(eq(channelsTable.id, ownChannel.id))
          .returning();
        ownChannel = reconciledChannel ?? ownChannel;
      }
    } catch (error) {
      // Do not make the authenticated dashboard unavailable when the provider is
      // temporarily unreachable or has not been configured in an environment.
      if (!(error instanceof FastPixNotConfiguredError)) {
        console.warn("Live-state reconciliation was unavailable", error instanceof Error ? error.message : error);
      }
    }
  }

  const followedRows = await db
    .select({ channel: channelsTable })
    .from(followsTable)
    .innerJoin(channelsTable, eq(followsTable.channelId, channelsTable.id))
    .where(eq(followsTable.followerUserId, userId));
  const followedChannels = await Promise.all(followedRows.map((r) => toChannelSummary(r.channel)));

  res.json(GetMeResponse.parse({
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: req.user!.role as "user" | "owner",
    channel: ownChannel ? await toChannelSummary(ownChannel) : null,
    followedChannels,
  }));
});

export default router;

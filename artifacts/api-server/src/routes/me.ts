import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  auditLogsTable,
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
import {
  clearActiveProfileGrant,
  establishActiveProfileGrant,
  requireAuth,
} from "../lib/auth";
import {
  toChannelSummaries,
  toChannelSummary,
} from "../lib/channelSerializer";
import { getActiveProfileMaturity } from "../lib/liveMaturity";
import {
  FastPixNotConfiguredError,
  getFastPixLiveStream,
} from "../lib/fastpix";

const router: IRouter = Router();
const MAX_VIEWER_PROFILES = 5;
const PROFILE_PIN_MAX_ATTEMPTS = 5;
const PROFILE_PIN_WINDOW_MS = 15 * 60 * 1000;

const selectViewerProfileBody = z.object({
  pin: z
    .string()
    .regex(/^\d{4,8}$/, "Use a 4 to 8 digit profile PIN.")
    .optional(),
});

const updateViewerProfilePinBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPin: z
    .string()
    .regex(/^\d{4,8}$/, "Use a 4 to 8 digit profile PIN.")
    .nullable(),
});

type ViewerProfileRow = typeof viewerProfilesTable.$inferSelect;

function toViewerProfile(profile: ViewerProfileRow) {
  return {
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    maturityLevel: profile.maturityLevel as "kids" | "standard" | "mature",
    isKidsProfile: profile.isKidsProfile,
    isDefault: profile.isDefault,
    isLocked: Boolean(profile.pinHash),
    createdAt: profile.createdAt,
  };
}

async function listOrCreateDefaultViewerProfiles(userId: number) {
  const profiles = await db
    .select()
    .from(viewerProfilesTable)
    .where(eq(viewerProfilesTable.userId, userId))
    .orderBy(asc(viewerProfilesTable.createdAt))
    .limit(MAX_VIEWER_PROFILES);

  if (profiles.length > 0) return profiles;

  return db.transaction(async (tx) => {
    // The initial empty-profile check is also serialized: concurrent first visits
    // must create exactly one default profile, never a second default identity.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const [user] = await tx
      .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return [];

    const currentProfiles = await tx
      .select()
      .from(viewerProfilesTable)
      .where(eq(viewerProfilesTable.userId, userId))
      .orderBy(asc(viewerProfilesTable.createdAt))
      .limit(MAX_VIEWER_PROFILES);
    if (currentProfiles.length > 0) return currentProfiles;

    const [created] = await tx
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
  });
}

router.get("/me/profiles", requireAuth, async (req, res): Promise<void> => {
  const profiles = await listOrCreateDefaultViewerProfiles(req.user!.userId);
  res.json(ListViewerProfilesResponse.parse(profiles.map(toViewerProfile)));
});

router.get(
  "/me/profiles/active",
  requireAuth,
  async (req, res): Promise<void> => {
    if (!req.activeProfileId) {
      res.json({ profile: null });
      return;
    }
    const [profile] = await db
      .select()
      .from(viewerProfilesTable)
      .where(
        and(
          eq(viewerProfilesTable.id, req.activeProfileId),
          eq(viewerProfilesTable.userId, req.user!.userId),
        ),
      )
      .limit(1);
    if (!profile) {
      clearActiveProfileGrant(res);
      res.json({ profile: null });
      return;
    }
    res.json({ profile: toViewerProfile(profile) });
  },
);

router.delete(
  "/me/profiles/active",
  requireAuth,
  async (_req, res): Promise<void> => {
    clearActiveProfileGrant(res);
    res.status(204).end();
  },
);

router.post(
  "/me/profiles/:id/select",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateViewerProfileParams.safeParse(req.params);
    const parsed = selectViewerProfileBody.safeParse(req.body ?? {});
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : (parsed.error?.message ?? "Invalid profile request"),
      });
      return;
    }

    const userId = req.user!.userId;
    const [profile] = await db
      .select()
      .from(viewerProfilesTable)
      .where(
        and(
          eq(viewerProfilesTable.id, params.data.id),
          eq(viewerProfilesTable.userId, userId),
        ),
      )
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Viewer profile not found" });
      return;
    }

    if (profile.pinHash) {
      const cutoff = new Date(Date.now() - PROFILE_PIN_WINDOW_MS);
      const [recentFailures] = await db
        .select({ count: sql<number>`COALESCE(COUNT(*), 0)::int` })
        .from(auditLogsTable)
        .where(
          and(
            eq(auditLogsTable.actorUserId, userId),
            eq(auditLogsTable.action, "viewer_profile_pin_failed"),
            eq(auditLogsTable.targetType, "viewer_profile"),
            eq(auditLogsTable.targetId, String(profile.id)),
            gte(auditLogsTable.createdAt, cutoff),
          ),
        );
      if (Number(recentFailures?.count ?? 0) >= PROFILE_PIN_MAX_ATTEMPTS) {
        res
          .status(429)
          .json({ error: "Too many profile PIN attempts. Try again later." });
        return;
      }

      const pinMatches =
        Boolean(parsed.data.pin) &&
        (await bcrypt.compare(parsed.data.pin!, profile.pinHash));
      if (!pinMatches) {
        await db.insert(auditLogsTable).values({
          actorUserId: userId,
          action: "viewer_profile_pin_failed",
          targetType: "viewer_profile",
          targetId: String(profile.id),
          reason: "invalid_pin",
          sessionId: req.user!.sessionId ?? null,
        });
        res.status(423).json({
          error: "This viewer profile is locked. Enter its PIN to continue.",
        });
        return;
      }
    }

    establishActiveProfileGrant(req, res, profile.id);
    await db.insert(auditLogsTable).values({
      actorUserId: userId,
      action: "viewer_profile_selected",
      targetType: "viewer_profile",
      targetId: String(profile.id),
      sessionId: req.user!.sessionId ?? null,
    });
    res.json({ profile: toViewerProfile(profile) });
  },
);

router.post(
  "/me/profiles/:id/pin",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateViewerProfileParams.safeParse(req.params);
    const parsed = updateViewerProfilePinBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : (parsed.error?.message ?? "Invalid profile request"),
      });
      return;
    }

    const userId = req.user!.userId;
    const [[profile], [user]] = await Promise.all([
      db
        .select()
        .from(viewerProfilesTable)
        .where(
          and(
            eq(viewerProfilesTable.id, params.data.id),
            eq(viewerProfilesTable.userId, userId),
          ),
        )
        .limit(1),
      db
        .select({ passwordHash: usersTable.passwordHash })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1),
    ]);
    if (!profile) {
      res.status(404).json({ error: "Viewer profile not found" });
      return;
    }
    if (
      !user ||
      !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))
    ) {
      res.status(401).json({ error: "Account re-authentication failed" });
      return;
    }

    const pinHash = parsed.data.newPin
      ? await bcrypt.hash(parsed.data.newPin, 12)
      : null;
    const [updated] = await db
      .update(viewerProfilesTable)
      .set({ pinHash, updatedAt: new Date() })
      .where(
        and(
          eq(viewerProfilesTable.id, profile.id),
          eq(viewerProfilesTable.userId, userId),
        ),
      )
      .returning();
    clearActiveProfileGrant(res);
    await db.insert(auditLogsTable).values({
      actorUserId: userId,
      action: parsed.data.newPin
        ? "viewer_profile_pin_set"
        : "viewer_profile_pin_removed",
      targetType: "viewer_profile",
      targetId: String(profile.id),
      sessionId: req.user!.sessionId ?? null,
    });
    res.json({ profile: toViewerProfile(updated ?? profile) });
  },
);

router.post("/me/profiles", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateViewerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  await listOrCreateDefaultViewerProfiles(userId);

  const isKidsProfile = parsed.data.isKidsProfile ?? false;
  const isDefault = parsed.data.isDefault ?? false;

  const created = await db.transaction(async (tx) => {
    // Serialize a user's profile mutations so concurrent requests cannot bypass
    // the product-wide five-profile boundary between count and insert.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const [profileCount] = await tx
      .select({ total: count() })
      .from(viewerProfilesTable)
      .where(eq(viewerProfilesTable.userId, userId));
    if ((profileCount?.total ?? 0) >= MAX_VIEWER_PROFILES) return null;

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
        maturityLevel: isKidsProfile
          ? "kids"
          : (parsed.data.maturityLevel ?? "standard"),
        isKidsProfile,
        isDefault,
      })
      .returning();

    return profile;
  });

  if (!created) {
    res.status(400).json({
      error: `You can create up to ${MAX_VIEWER_PROFILES} viewer profiles.`,
    });
    return;
  }

  res
    .status(201)
    .json(CreateViewerProfileResponse.parse(toViewerProfile(created)));
});

router.patch(
  "/me/profiles/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateViewerProfileParams.safeParse(req.params);
    const parsed = UpdateViewerProfileBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : (parsed.error?.message ?? "Invalid request body"),
      });
      return;
    }

    const userId = req.user!.userId;
    const [existing] = await db
      .select()
      .from(viewerProfilesTable)
      .where(
        and(
          eq(viewerProfilesTable.id, params.data.id),
          eq(viewerProfilesTable.userId, userId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "Viewer profile not found" });
      return;
    }
    if (existing.isDefault && parsed.data.isDefault === false) {
      res.status(400).json({
        error:
          "Choose another profile as default before changing this profile.",
      });
      return;
    }

    const isKidsProfile = parsed.data.isKidsProfile ?? existing.isKidsProfile;
    const nextMaturityLevel = isKidsProfile
      ? "kids"
      : (parsed.data.maturityLevel ?? existing.maturityLevel);
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
          ...(parsed.data.name !== undefined
            ? { name: parsed.data.name.trim() }
            : {}),
          ...(parsed.data.avatarUrl !== undefined
            ? { avatarUrl: parsed.data.avatarUrl }
            : {}),
          ...(parsed.data.isDefault !== undefined
            ? { isDefault: parsed.data.isDefault }
            : {}),
          isKidsProfile,
          maturityLevel: nextMaturityLevel,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(viewerProfilesTable.id, existing.id),
            eq(viewerProfilesTable.userId, userId),
          ),
        )
        .returning();

      return profile;
    });

    if (!updated) {
      res.status(500).json({ error: "Unable to update viewer profile" });
      return;
    }

    clearActiveProfileGrant(res);
    await db.insert(auditLogsTable).values({
      actorUserId: userId,
      action: "viewer_profile_updated",
      targetType: "viewer_profile",
      targetId: String(updated.id),
      afterState: {
        maturityLevel: updated.maturityLevel,
        isKidsProfile: updated.isKidsProfile,
        isDefault: updated.isDefault,
      },
      sessionId: req.user!.sessionId ?? null,
    });
    res.json(UpdateViewerProfileResponse.parse(toViewerProfile(updated)));
  },
);

router.delete(
  "/me/profiles/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteViewerProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [profile] = await db
      .select()
      .from(viewerProfilesTable)
      .where(
        and(
          eq(viewerProfilesTable.id, params.data.id),
          eq(viewerProfilesTable.userId, req.user!.userId),
        ),
      );

    if (!profile) {
      res.status(404).json({ error: "Viewer profile not found" });
      return;
    }
    if (profile.isDefault) {
      res
        .status(400)
        .json({ error: "The default viewer profile cannot be deleted." });
      return;
    }

    await db
      .delete(viewerProfilesTable)
      .where(
        and(
          eq(viewerProfilesTable.id, profile.id),
          eq(viewerProfilesTable.userId, req.user!.userId),
        ),
      );
    clearActiveProfileGrant(res);
    await db.insert(auditLogsTable).values({
      actorUserId: req.user!.userId,
      action: "viewer_profile_deleted",
      targetType: "viewer_profile",
      targetId: String(profile.id),
      sessionId: req.user!.sessionId ?? null,
    });
    res.status(204).end();
  },
);

router.get(
  "/me/notifications",
  requireAuth,
  async (req, res): Promise<void> => {
    const query = GetNotificationInboxQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const userId = req.user!.userId;
    const [items, [unread], [total]] = await Promise.all([
      db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId))
        .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
        .limit(query.data.limit)
        .offset(query.data.offset),
      db
        .select({ count: sql<number>`COALESCE(COUNT(*), 0)::int` })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, userId),
            eq(notificationsTable.isRead, false),
          ),
        ),
      db
        .select({ count: sql<number>`COALESCE(COUNT(*), 0)::int` })
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId)),
    ]);

    res.json(
      GetNotificationInboxResponse.parse({
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
        total: Number(total?.count ?? 0),
        limit: query.data.limit,
        offset: query.data.offset,
      }),
    );
  },
);

router.patch(
  "/me/notifications/:id/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = MarkNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [notification] = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationsTable.id, params.data.id),
          eq(notificationsTable.userId, req.user!.userId),
        ),
      )
      .returning();
    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json(
      MarkNotificationReadResponse.parse({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data ?? {},
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/me/notification-preferences",
  requireAuth,
  async (req, res): Promise<void> => {
    const [preference] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.userId, req.user!.userId),
          isNull(notificationPreferencesTable.channelId),
        ),
      )
      .limit(1);

    res.json({
      notifyOnLive: preference?.notifyOnLive ?? true,
      notifyOnUpload: preference?.notifyOnUpload ?? true,
      notifyOnClip: preference?.notifyOnClip ?? false,
      emailNotifications: preference?.emailNotifications ?? false,
    });
  },
);

router.get(
  "/me/activity-observability",
  requireAuth,
  async (req, res): Promise<void> => {
    const [user] = await db
      .select({ enabled: usersTable.activityObservabilityEnabled })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));
    res.json(
      GetActivityObservabilityPreferencesResponse.parse({
        enabled: user?.enabled ?? false,
      }),
    );
  },
);

router.put(
  "/me/activity-observability",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = UpdateActivityObservabilityPreferencesBody.safeParse(
      req.body,
    );
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
      await db
        .delete(userActivityPresenceTable)
        .where(eq(userActivityPresenceTable.userId, userId));
    }

    res.json(
      UpdateActivityObservabilityPreferencesResponse.parse({
        enabled: updated?.enabled ?? false,
      }),
    );
  },
);

router.post(
  "/me/activity-presence",
  requireAuth,
  async (req, res): Promise<void> => {
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
      res
        .status(403)
        .json({ error: "Activity visibility is disabled for this account." });
      return;
    }

    const [existing] = await db
      .select({ userId: userActivityPresenceTable.userId })
      .from(userActivityPresenceTable)
      .where(eq(userActivityPresenceTable.userId, userId));
    const values = {
      routeKey: parsed.data.routeKey,
      deviceClass: parsed.data.deviceClass,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(userActivityPresenceTable)
        .set(values)
        .where(eq(userActivityPresenceTable.userId, userId));
    } else {
      await db.insert(userActivityPresenceTable).values({ userId, ...values });
    }

    res.status(204).end();
  },
);

router.put(
  "/me/notification-preferences",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = UpdateNotificationPreferencesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = req.user!.userId;
    const [existing] = await db
      .select({ id: notificationPreferencesTable.id })
      .from(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.userId, userId),
          isNull(notificationPreferencesTable.channelId),
        ),
      )
      .limit(1);

    const [preference] = existing
      ? await db
          .update(notificationPreferencesTable)
          .set(parsed.data)
          .where(eq(notificationPreferencesTable.id, existing.id))
          .returning()
      : await db
          .insert(notificationPreferencesTable)
          .values({ userId, ...parsed.data })
          .returning();

    res.json({
      notifyOnLive: preference.notifyOnLive,
      notifyOnUpload: preference.notifyOnUpload,
      notifyOnClip: preference.notifyOnClip,
      emailNotifications: preference.emailNotifications,
    });
  },
);

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let [ownChannel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));

  // Webhooks remain the primary real-time state source. This short-lived provider
  // reconciliation lets an open Creator Studio recover safely from a delayed or
  // missed delivery without exposing the provider to public viewers.
  if (ownChannel?.fastpixLiveStreamId) {
    try {
      const liveStream = await getFastPixLiveStream(
        ownChannel.fastpixLiveStreamId,
      );
      const providerStatus =
        typeof liveStream?.status === "string" ? liveStream.status : null;
      const playbackId = liveStream?.playbackIds?.[0]?.id;
      const expectedIsLive =
        providerStatus === "active"
          ? true
          : ["idle", "disabled"].includes(providerStatus ?? "")
            ? false
            : ownChannel.isLive;

      if (
        expectedIsLive !== ownChannel.isLive ||
        (typeof playbackId === "string" &&
          playbackId !== ownChannel.fastpixPlaybackId)
      ) {
        const [reconciledChannel] = await db
          .update(channelsTable)
          .set({
            isLive: expectedIsLive,
            ...(expectedIsLive && !ownChannel.isLive
              ? { lastStreamAt: new Date() }
              : {}),
            ...(typeof playbackId === "string"
              ? { fastpixPlaybackId: playbackId }
              : {}),
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
        console.warn(
          "Live-state reconciliation was unavailable",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  const followedRows = await db
    .select({ channel: channelsTable })
    .from(followsTable)
    .innerJoin(channelsTable, eq(followsTable.channelId, channelsTable.id))
    .where(eq(followsTable.followerUserId, userId));
  const profileMaturity = await getActiveProfileMaturity(req);
  const followedChannels = await toChannelSummaries(
    followedRows
      .filter(
        ({ channel }) => !channel.matureContent || profileMaturity === "mature",
      )
      .map(({ channel }) => channel),
  );

  res.json(
    GetMeResponse.parse({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: req.user!.role as "user" | "owner",
      channel: ownChannel ? await toChannelSummary(ownChannel) : null,
      followedChannels,
    }),
  );
});

export default router;

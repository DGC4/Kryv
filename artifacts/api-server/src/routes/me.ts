import { and, asc, eq, isNull } from "drizzle-orm";
import {
  channelsTable,
  db,
  followsTable,
  notificationPreferencesTable,
  usersTable,
  viewerProfilesTable,
} from "@workspace/db";
import {
  CreateViewerProfileBody,
  CreateViewerProfileResponse,
  DeleteViewerProfileParams,
  GetMeResponse,
  ListViewerProfilesResponse,
  UpdateNotificationPreferencesBody,
  UpdateViewerProfileBody,
  UpdateViewerProfileParams,
  UpdateViewerProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";

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
    res.status(400).json({ error: !params.success ? params.error.message : parsed.error.message });
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

  const [ownChannel] = await db.select().from(channelsTable).where(eq(channelsTable.ownerUserId, userId));
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
    role: user.role as "user" | "owner",
    channel: ownChannel ? await toChannelSummary(ownChannel) : null,
    followedChannels,
  }));
});

export default router;

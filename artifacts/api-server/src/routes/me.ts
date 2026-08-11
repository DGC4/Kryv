import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, channelsTable, followsTable, notificationPreferencesTable, usersTable } from "@workspace/db";
import { GetMeResponse, UpdateNotificationPreferencesBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";

const router: IRouter = Router();

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
  
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [ownChannel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));

  const followedRows = await db
    .select({ channel: channelsTable })
    .from(followsTable)
    .innerJoin(channelsTable, eq(followsTable.channelId, channelsTable.id))
    .where(eq(followsTable.followerUserId, userId));

  const followedChannels = await Promise.all(
    followedRows.map((r) => toChannelSummary(r.channel)),
  );

  res.json(
    GetMeResponse.parse({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role as "user" | "owner",
      channel: ownChannel ? await toChannelSummary(ownChannel) : null,
      followedChannels,
    }),
  );
});

export default router;

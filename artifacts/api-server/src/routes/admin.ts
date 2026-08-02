import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  channelsTable,
  videosTable,
} from "@workspace/db";
import {
  GetAdminStatsResponse,
  ListAdminUsersResponse,
  UpdateAdminUserParams,
  UpdateAdminUserBody,
  UpdateAdminUserResponse,
  ListAdminChannelsResponse,
  DeleteAdminChannelParams,
  ListAdminVideosResponse,
  DeleteAdminVideoParams,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";
import { toVideoSummary } from "../lib/videoSerializer";

const router: IRouter = Router();

router.get("/admin/stats", requireOwner, async (_req, res): Promise<void> => {
  const [users] = await db
    .select({
      totalUsers: sql<number>`count(*)`.mapWith(Number),
      bannedUsers: sql<number>`count(*) filter (where ${usersTable.banned})`.mapWith(
        Number,
      ),
    })
    .from(usersTable);

  const [channels] = await db
    .select({
      totalChannels: sql<number>`count(*)`.mapWith(Number),
      liveChannels: sql<number>`count(*) filter (where ${channelsTable.isLive})`.mapWith(
        Number,
      ),
    })
    .from(channelsTable);

  const [videos] = await db
    .select({
      totalVideos: sql<number>`count(*)`.mapWith(Number),
      totalViews: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)`.mapWith(
        Number,
      ),
    })
    .from(videosTable);

  res.json(
    GetAdminStatsResponse.parse({
      totalUsers: users?.totalUsers ?? 0,
      bannedUsers: users?.bannedUsers ?? 0,
      totalChannels: channels?.totalChannels ?? 0,
      liveChannels: channels?.liveChannels ?? 0,
      totalVideos: videos?.totalVideos ?? 0,
      totalViews: videos?.totalViews ?? 0,
    }),
  );
});

router.get("/admin/users", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable);
  res.json(ListAdminUsersResponse.parse(rows));
});

router.patch(
  "/admin/users/:id",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAdminUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // FanoDGC (owner) is permanently protected — no modification allowed via any endpoint.
    if (existing.role === "owner") {
      res.status(403).json({ error: "The owner account cannot be modified." });
      return;
    }
    // Block any attempt to grant owner role to another account.
    if ((parsed.data as any).role === "owner") {
      res.status(403).json({ error: "Cannot assign owner role via this endpoint." });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.id, params.data.id))
      .returning();

    res.json(UpdateAdminUserResponse.parse(updated));
  },
);

router.get(
  "/admin/channels",
  requireOwner,
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(channelsTable);
    const results = await Promise.all(rows.map(toChannelSummary));
    res.json(ListAdminChannelsResponse.parse(results));
  },
);

router.delete(
  "/admin/channels/:id",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = DeleteAdminChannelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(channelsTable)
      .where(eq(channelsTable.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    res.status(204).end();
  },
);

router.get("/admin/videos", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db.select().from(videosTable);
  const results = await Promise.all(rows.map(toVideoSummary));
  res.json(ListAdminVideosResponse.parse(results));
});

router.delete(
  "/admin/videos/:id",
  requireOwner,
  async (req, res): Promise<void> => {
    const params = DeleteAdminVideoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(videosTable)
      .where(eq(videosTable.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.status(204).end();
  },
);

export default router;

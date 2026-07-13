import { Router, type IRouter } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, channelsTable, followsTable } from "@workspace/db";
import {
  ListChannelsQueryParams,
  ListChannelsResponse,
  CreateChannelBody,
  CreateChannelResponse,
  GetChannelParams,
  GetChannelResponse,
  UpdateChannelParams,
  UpdateChannelBody,
  UpdateChannelResponse,
  CreateChannelStreamParams,
  CreateChannelStreamResponse,
  FollowChannelParams,
  FollowChannelResponse,
  UnfollowChannelParams,
  UnfollowChannelResponse,
} from "@workspace/api-zod";
import { requireAuth, attachUserId, getOrCreateUser } from "../lib/auth";
import {
  toChannelSummary,
  toChannelDetail,
  uniqueChannelSlug,
} from "../lib/channelSerializer";
import { createMuxLiveStream, MuxNotConfiguredError } from "../lib/mux";

const router: IRouter = Router();

router.get("/channels", attachUserId, async (req, res): Promise<void> => {
  const query = ListChannelsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db.select().from(channelsTable);

  if (query.data.live !== undefined) {
    rows = rows.filter((c) => c.isLive === query.data.live);
  }
  if (query.data.search) {
    const needle = query.data.search.toLowerCase();
    rows = rows.filter(
      (c) =>
        c.displayName.toLowerCase().includes(needle) ||
        (c.streamTitle ?? "").toLowerCase().includes(needle),
    );
  }
  if (query.data.categorySlug) {
    const { categoriesTable } = await import("@workspace/db");
    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, query.data.categorySlug));
    rows = category ? rows.filter((c) => c.categoryId === category.id) : [];
  }

  const results = await Promise.all(rows.map(toChannelSummary));
  res.json(ListChannelsResponse.parse(results));
});

router.post("/channels", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = CreateChannelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await getOrCreateUser(userId);

  const [existing] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));
  if (existing) {
    res.status(409).json({ error: "You already have a channel" });
    return;
  }

  const slug = await uniqueChannelSlug(parsed.data.displayName);
  const [channel] = await db
    .insert(channelsTable)
    .values({
      ownerUserId: userId,
      slug,
      displayName: parsed.data.displayName,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId ?? null,
    })
    .returning();

  res
    .status(201)
    .json(CreateChannelResponse.parse(await toChannelDetail(channel, userId)));
});

router.get(
  "/channels/:id",
  attachUserId,
  async (req, res): Promise<void> => {
    const params = GetChannelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const viewerUserId = (req as typeof req & { userId?: string }).userId;
    res.json(
      GetChannelResponse.parse(await toChannelDetail(channel, viewerUserId)),
    );
  },
);

router.patch(
  "/channels/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;
    const params = UpdateChannelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateChannelBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    if (channel.ownerUserId !== userId) {
      res.status(403).json({ error: "Not the channel owner" });
      return;
    }

    const [updated] = await db
      .update(channelsTable)
      .set(parsed.data)
      .where(eq(channelsTable.id, params.data.id))
      .returning();

    res.json(UpdateChannelResponse.parse(await toChannelDetail(updated, userId)));
  },
);

router.post(
  "/channels/:id/stream",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;
    const params = CreateChannelStreamParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    if (channel.ownerUserId !== userId) {
      res.status(403).json({ error: "Not the channel owner" });
      return;
    }

    try {
      const { muxLiveStreamId, muxStreamKey, muxPlaybackId } =
        await createMuxLiveStream();

      await db
        .update(channelsTable)
        .set({ muxLiveStreamId, muxStreamKey, muxPlaybackId })
        .where(eq(channelsTable.id, channel.id));

      res.json(
        CreateChannelStreamResponse.parse({
          rtmpUrl: "rtmp://global-live.mux.com:5222/app",
          streamKey: muxStreamKey,
          playbackId: muxPlaybackId,
        }),
      );
    } catch (err) {
      if (err instanceof MuxNotConfiguredError) {
        req.log.warn("Mux not configured — cannot create live stream");
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.post(
  "/channels/:id/follow",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;
    const params = FollowChannelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    await getOrCreateUser(userId);

    await db
      .insert(followsTable)
      .values({ followerUserId: userId, channelId: channel.id })
      .onConflictDoNothing();

    res.json(
      FollowChannelResponse.parse(await toChannelDetail(channel, userId)),
    );
  },
);

router.delete(
  "/channels/:id/follow",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;
    const params = UnfollowChannelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    await db
      .delete(followsTable)
      .where(
        and(
          eq(followsTable.channelId, channel.id),
          eq(followsTable.followerUserId, userId),
        ),
      );

    res.json(
      UnfollowChannelResponse.parse(await toChannelDetail(channel, userId)),
    );
  },
);

export default router;

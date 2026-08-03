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
  GetChannelBySlugParams,
} from "@workspace/api-zod";
import { requireAuth, attachUserId } from "../lib/auth";
import {
  toChannelSummary,
  toChannelDetail,
  uniqueChannelSlug,
} from "../lib/channelSerializer";
import { createMuxLiveStream, MuxNotConfiguredError } from "../lib/mux";
import { logActivity } from "../lib/tracking";

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
  const userId = req.user!.userId;
  const parsed = CreateChannelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));
  if (existing) {
    res
      .status(200)
      .json(CreateChannelResponse.parse(await toChannelDetail(existing, userId)));
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

    const viewerUserId = req.user?.userId;
    res.json(
      GetChannelResponse.parse(await toChannelDetail(channel, viewerUserId)),
    );
  },
);

router.get(
  "/channels/slug/:slug",
  attachUserId,
  async (req, res): Promise<void> => {
    const params = GetChannelBySlugParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.slug, params.data.slug));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const viewerUserId = req.user?.userId;
    res.json(
      GetChannelResponse.parse(await toChannelDetail(channel, viewerUserId)),
    );
  },
);

router.patch(
  "/channels/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
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

    // ── Prioritize Mux (Real Infrastructure) ──────────────────────────────
    // If we already have a Mux stream key, use it as the primary key.
    if (channel.muxStreamKey) {
      logActivity(req, "get_stream_key", { channelId: channel.id }).catch(err => console.error("logActivity error:", err));
      res.json(
        CreateChannelStreamResponse.parse({
          rtmpUrl: "rtmp://global-live.mux.com:5222/app",
          streamKey: channel.muxStreamKey,
          playbackId: channel.muxPlaybackId || "",
        }),
      );
      return;
    }

    // Try to provision a new Mux live stream
    try {
      const { muxLiveStreamId, muxStreamKey, muxPlaybackId } = await createMuxLiveStream();
      
      await db
        .update(channelsTable)
        .set({
          streamKey: muxStreamKey, // Use Mux key as the primary streamKey
          streamKeyGeneratedAt: new Date(),
          muxLiveStreamId,
          muxStreamKey,
          muxPlaybackId,
        })
        .where(eq(channelsTable.id, channel.id));

      logActivity(req, "create_stream_mux", { channelId: channel.id }).catch(err => console.error("logActivity error:", err));
      
      res.json(
        CreateChannelStreamResponse.parse({
          rtmpUrl: "rtmp://global-live.mux.com:5222/app",
          streamKey: muxStreamKey,
          playbackId,
        }),
      );
      return;
    } catch (err) {
      // If Mux is NOT configured, fall back to self-hosted key generation
      if (err instanceof MuxNotConfiguredError) {
        // Only generate self-hosted if Mux is missing from environment
        const { randomBytes } = await import("crypto");
        const rawKey = randomBytes(20).toString("hex");
        const selfHostedKey = `live_${channel.id}_${rawKey}`;
        
        await db
          .update(channelsTable)
          .set({ 
            streamKey: selfHostedKey, 
            streamKeyGeneratedAt: new Date() 
          })
          .where(eq(channelsTable.id, channel.id));

        logActivity(req, "create_stream_fallback", { channelId: channel.id }).catch(err => console.error("logActivity error:", err));
        
        res.json(
          CreateChannelStreamResponse.parse({
            rtmpUrl: "rtmp://global-live.mux.com:5222/app", // Default ingest
            streamKey: selfHostedKey,
            playbackId: "",
          }),
        );
      } else {
        // Real Mux error (API down, etc.) — throw so the frontend can show the error
        throw err;
      }
    }
  },
);

router.post(
  "/channels/:id/follow",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
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

// POST /channels/:id/stream/reset — Regenerate stream key (invalidates old one)
router.post(
  "/channels/:id/stream/reset",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
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

    // Resetting should always try to get a fresh Mux stream if possible
    try {
      const { muxLiveStreamId, muxStreamKey, muxPlaybackId } = await createMuxLiveStream();
      
      await db
        .update(channelsTable)
        .set({
          streamKey: muxStreamKey,
          streamKeyGeneratedAt: new Date(),
          muxLiveStreamId,
          muxStreamKey,
          muxPlaybackId,
        })
        .where(eq(channelsTable.id, channel.id));

      logActivity(req, "reset_stream_key_mux", { channelId: channel.id }).catch(err => console.error("logActivity error:", err));

      res.json(
        CreateChannelStreamResponse.parse({
          rtmpUrl: "rtmp://global-live.mux.com:5222/app",
          streamKey: muxStreamKey,
          playbackId,
        }),
      );
    } catch (err) {
      if (err instanceof MuxNotConfiguredError) {
        const { randomBytes } = await import("crypto");
        const rawKey = randomBytes(20).toString("hex");
        const selfHostedKey = `live_${channel.id}_${rawKey}`;

        await db
          .update(channelsTable)
          .set({ streamKey: selfHostedKey, streamKeyGeneratedAt: new Date() })
          .where(eq(channelsTable.id, channel.id));

        logActivity(req, "reset_stream_key_fallback", { channelId: channel.id }).catch(err => console.error("logActivity error:", err));

        res.json(
          CreateChannelStreamResponse.parse({
            rtmpUrl: "rtmp://global-live.mux.com:5222/app",
            streamKey: selfHostedKey,
            playbackId: "",
          }),
        );
      } else {
        throw err;
      }
    }
  },
);

export default router;

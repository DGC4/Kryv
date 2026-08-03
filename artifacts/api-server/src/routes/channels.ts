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
import { createFastPixLiveStream, FastPixNotConfiguredError } from "../lib/fastpix";
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

    // ── Robust Stream Key Logic ──────────────────────────────────────────
    
    // 1. If we already have a REAL FastPix key, return it.
    if (channel.fastpixStreamKey) {
      return res.json(CreateChannelStreamResponse.parse({
        rtmpUrl: "rtmps://live.fastpix.io:443/live",
        streamKey: channel.fastpixStreamKey,
        playbackId: channel.fastpixPlaybackId || "",
      }));
    }

    // 2. Try to provision a new FastPix live stream
    try {
      const { fastpixLiveStreamId, fastpixStreamKey, fastpixPlaybackId } = await createFastPixLiveStream();
      
      await db.update(channelsTable).set({
        streamKey: fastpixStreamKey,
        streamKeyGeneratedAt: new Date(),
        fastpixLiveStreamId,
        fastpixStreamKey,
        fastpixPlaybackId,
      }).where(eq(channelsTable.id, channel.id));

      return res.json(CreateChannelStreamResponse.parse({
        rtmpUrl: "rtmps://live.fastpix.io:443/live",
        streamKey: fastpixStreamKey,
        playbackId: fastpixPlaybackId ?? "",
      }));
    } catch (err) {
      // 3. Fallback ONLY if FastPix is not configured at all AND we don't have any key yet
      if (err instanceof FastPixNotConfiguredError) {
        if (channel.streamKey) {
          return res.json(CreateChannelStreamResponse.parse({
            rtmpUrl: "rtmps://live.fastpix.io:443/live",
            streamKey: channel.streamKey,
            playbackId: "",
          }));
        }

        console.warn("FastPix is not configured, using placeholder stream key.");
        const { randomBytes } = await import("crypto");
        const selfHostedKey = `live_${channel.id}_${randomBytes(20).toString("hex")}`;
        
        await db.update(channelsTable).set({ 
          streamKey: selfHostedKey, 
          streamKeyGeneratedAt: new Date() 
        }).where(eq(channelsTable.id, channel.id));

        return res.json(CreateChannelStreamResponse.parse({
          rtmpUrl: "rtmps://live.fastpix.io:443/live",
          streamKey: selfHostedKey,
          playbackId: "",
        }));
      }

      // 4. If FastPix IS configured but failing (e.g. invalid tokens), we MUST report the error
      console.error("FastPix API Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown FastPix error";
      return res.status(502).json({ 
        error: `FastPix Integration Error: ${errorMessage}. Please check your ACCESS_TOKEN and SECRET_KEY in Render.` 
      });
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

    // Resetting MUST always try to get a fresh REAL FastPix stream
    try {
      const { fastpixLiveStreamId, fastpixStreamKey, fastpixPlaybackId } = await createFastPixLiveStream();
      
      await db.update(channelsTable).set({
        streamKey: fastpixStreamKey,
        streamKeyGeneratedAt: new Date(),
        fastpixLiveStreamId,
        fastpixStreamKey,
        fastpixPlaybackId,
      }).where(eq(channelsTable.id, channel.id));

      return res.json(CreateChannelStreamResponse.parse({
        rtmpUrl: "rtmps://live.fastpix.io:443/live",
        streamKey: fastpixStreamKey,
        playbackId: fastpixPlaybackId ?? "",
      }));
    } catch (err) {
      if (err instanceof FastPixNotConfiguredError) {
        // If they explicitly clicked "Rotate" but FastPix isn't set up, we should tell them
        return res.status(503).json({ 
          error: "FastPix is not configured. Please set ACCESS_TOKEN and SECRET_KEY in Render to generate a real stream key." 
        });
      }

      console.error("FastPix API Error (Reset):", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown FastPix error";
      return res.status(502).json({ 
        error: `FastPix Integration Error: ${errorMessage}. Please check your ACCESS_TOKEN and SECRET_KEY in Render.` 
      });
    }
  },
);

export default router;

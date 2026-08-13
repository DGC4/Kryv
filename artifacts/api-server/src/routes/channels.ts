import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { db, channelsTable, chatMessagesTable, followsTable, streamSessionsTable, subscriptionsTable, tipsTable } from "@workspace/db";
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
  GetChannelAnalyticsParams,
  GetChannelAnalyticsResponse,
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
import {
  createFastPixLiveStream,
  FastPixNotConfiguredError,
  getFastPixViewerCount,
} from "../lib/fastpix";
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

  if (query.data.live === true) {
    // Keep direct category links current even when the viewer did not visit the home directory first.
    rows = await Promise.all(
      rows.map(async (channel) => {
        if (!channel.fastpixLiveStreamId) return channel;
        const viewerCount = await getFastPixViewerCount(channel.fastpixLiveStreamId);
        if (viewerCount === null || viewerCount === channel.viewerCount) return channel;

        await db
          .update(channelsTable)
          .set({
            viewerCount,
            peakViewerCount: sql`GREATEST(${channelsTable.peakViewerCount}, ${viewerCount})`,
          })
          .where(eq(channelsTable.id, channel.id));
        return { ...channel, viewerCount, peakViewerCount: Math.max(channel.peakViewerCount, viewerCount) };
      }),
    );
  }

  // Most-viewed broadcasts lead every live list, including category pages.
  rows.sort((a, b) => b.viewerCount - a.viewerCount);

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

router.get(
  "/channels/:id/analytics",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const params = GetChannelAnalyticsParams.safeParse(req.params);
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

    const periodDays = 30;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const [summary] = await db
      .select({
        totalStreams: sql<number>`COALESCE(COUNT(*), 0)::int`,
        totalStreamSeconds: sql<number>`COALESCE(SUM(COALESCE(${streamSessionsTable.durationSeconds}, EXTRACT(EPOCH FROM (COALESCE(${streamSessionsTable.endedAt}, NOW()) - ${streamSessionsTable.startedAt}))::int)), 0)::int`,
        peakViewers: sql<number>`COALESCE(MAX(${streamSessionsTable.peakViewers}), 0)::int`,
        averageViewers: sql<number>`COALESCE(ROUND(AVG(${streamSessionsTable.avgViewers})), 0)::int`,
      })
      .from(streamSessionsTable)
      .where(
        and(
          eq(streamSessionsTable.channelId, channel.id),
          gte(streamSessionsTable.startedAt, periodStart),
        ),
      );

    const [chatSummary] = await db
      .select({ totalChatMessages: sql<number>`COALESCE(COUNT(*), 0)::int` })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.channelId, channel.id),
          gte(chatMessagesTable.createdAt, periodStart),
        ),
      );

    const [[tipSummary], [subscriptionSummary]] = await Promise.all([
      db
        .select({ completedTipCount: sql<number>`COALESCE(COUNT(*), 0)::int` })
        .from(tipsTable)
        .where(and(eq(tipsTable.receiverChannelId, channel.id), eq(tipsTable.status, "completed"), gte(tipsTable.createdAt, periodStart))),
      db
        .select({ activeSubscriptionCount: sql<number>`COALESCE(COUNT(*), 0)::int` })
        .from(subscriptionsTable)
        .where(and(eq(subscriptionsTable.channelId, channel.id), eq(subscriptionsTable.status, "active"), or(isNull(subscriptionsTable.expiresAt), gte(subscriptionsTable.expiresAt, new Date())))),
    ]);

    const recentStreams = await db
      .select({
        id: streamSessionsTable.id,
        title: streamSessionsTable.title,
        startedAt: streamSessionsTable.startedAt,
        endedAt: streamSessionsTable.endedAt,
        durationSeconds: streamSessionsTable.durationSeconds,
        peakViewers: streamSessionsTable.peakViewers,
        averageViewers: streamSessionsTable.avgViewers,
        totalChatMessages: streamSessionsTable.totalChatMessages,
      })
      .from(streamSessionsTable)
      .where(eq(streamSessionsTable.channelId, channel.id))
      .orderBy(desc(streamSessionsTable.startedAt))
      .limit(5);

    res.json(
      GetChannelAnalyticsResponse.parse({
        periodDays,
        isLive: channel.isLive,
        currentViewerCount: channel.viewerCount,
        followerCount: channel.followerCount,
        subscriberCount: channel.subCount,
        totalStreams: Number(summary?.totalStreams ?? 0),
        totalStreamSeconds: Number(summary?.totalStreamSeconds ?? 0),
        peakViewers: Number(summary?.peakViewers ?? 0),
        averageViewers: Number(summary?.averageViewers ?? 0),
        totalChatMessages: Number(chatSummary?.totalChatMessages ?? 0),
        completedTipCount: Number(tipSummary?.completedTipCount ?? 0),
        activeSubscriptionCount: Number(subscriptionSummary?.activeSubscriptionCount ?? 0),
        recentStreams,
      }),
    );
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
    
    // 1. If we already have a real FastPix key, return it.
    if (channel.fastpixStreamKey) {
      res.json(CreateChannelStreamResponse.parse({
        rtmpUrl: "rtmps://live.fastpix.io:443/live",
        streamKey: channel.fastpixStreamKey,
        playbackId: channel.fastpixPlaybackId || "",
      }));
      return;
    }

    // 2. Try to provision a new FastPix live stream
    try {
      const { fastpixLiveStreamId, fastpixStreamKey, fastpixPlaybackId } = await createFastPixLiveStream(channel.id);
      
      await db.update(channelsTable).set({
        streamKey: fastpixStreamKey,
        streamKeyGeneratedAt: new Date(),
        fastpixLiveStreamId,
        fastpixStreamKey,
        fastpixPlaybackId,
      }).where(eq(channelsTable.id, channel.id));

      res.json(CreateChannelStreamResponse.parse({
        rtmpUrl: "rtmps://live.fastpix.io:443/live",
        streamKey: fastpixStreamKey,
        playbackId: fastpixPlaybackId ?? "",
      }));
      return;
    } catch (err) {
      // Never manufacture a placeholder key: it would look valid but cannot ingest to FastPix.
      if (err instanceof FastPixNotConfiguredError) {
        res.status(503).json({
          error: "FastPix is not configured. Set the FastPix access credentials before creating a stream key.",
        });
        return;
      }

      console.error("FastPix API Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown FastPix error";
      res.status(502).json({
        error: `FastPix Integration Error: ${errorMessage}. Check the FastPix credentials in the server environment.`,
      });
      return;
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
      const { fastpixLiveStreamId, fastpixStreamKey, fastpixPlaybackId } = await createFastPixLiveStream(channel.id);
      
      await db.update(channelsTable).set({
        streamKey: fastpixStreamKey,
        streamKeyGeneratedAt: new Date(),
        fastpixLiveStreamId,
        fastpixStreamKey,
        fastpixPlaybackId,
      }).where(eq(channelsTable.id, channel.id));

      res.json(CreateChannelStreamResponse.parse({
        rtmpUrl: "rtmps://live.fastpix.io:443/live",
        streamKey: fastpixStreamKey,
        playbackId: fastpixPlaybackId ?? "",
      }));
      return;
    } catch (err) {
      if (err instanceof FastPixNotConfiguredError) {
        res.status(503).json({
          error: "FastPix is not configured. Set the FastPix access credentials before rotating a stream key.",
        });
        return;
      }

      console.error("FastPix API Error (Reset):", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown FastPix error";
      res.status(502).json({
        error: `FastPix Integration Error: ${errorMessage}. Check the FastPix credentials in the server environment.`,
      });
      return;
    }
  },
);

// POST /channels/:id/heartbeat — Viewer presence heartbeat (call every 30s while watching)
// It refreshes the near-real-time, approximate concurrent-viewer count from FastPix
// and persists it for live-directory and category ranking.
router.post(
  "/channels/:id/heartbeat",
  async (req, res): Promise<void> => {
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      res.status(400).json({ error: "Invalid channel ID" });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channelId));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    // Only count viewers when the channel is actually live
    if (!channel.isLive) {
      res.json({ viewerCount: 0 });
      return;
    }

    // Try to get FastPix's near-real-time concurrent viewer count.
    const fastpixViewerCount = channel.fastpixLiveStreamId
      ? await getFastPixViewerCount(channel.fastpixLiveStreamId)
      : null;

    // Update the DB viewer count
    const newCount = fastpixViewerCount !== null ? fastpixViewerCount : channel.viewerCount;
    await db
      .update(channelsTable)
      .set({
        viewerCount: newCount,
        // Track peak viewers
        peakViewerCount: sql`GREATEST(${channelsTable.peakViewerCount}, ${newCount})`,
      })
      .where(eq(channelsTable.id, channelId));

    res.json({ viewerCount: newCount });
  },
);

// GET /channels/:id/viewers — Get current viewer count (public)
router.get(
  "/channels/:id/viewers",
  async (req, res): Promise<void> => {
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      res.status(400).json({ error: "Invalid channel ID" });
      return;
    }

    const [channel] = await db
      .select({ id: channelsTable.id, isLive: channelsTable.isLive, viewerCount: channelsTable.viewerCount, fastpixLiveStreamId: channelsTable.fastpixLiveStreamId })
      .from(channelsTable)
      .where(eq(channelsTable.id, channelId));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    if (!channel.isLive) {
      res.json({ viewerCount: 0, isLive: false });
      return;
    }

    // Try FastPix API for a near-real-time count.
    const fastpixViewerCount = channel.fastpixLiveStreamId
      ? await getFastPixViewerCount(channel.fastpixLiveStreamId)
      : null;
    if (fastpixViewerCount !== null) {
      // Persist the FastPix value so discovery and category pages can rank live channels.
      await db
        .update(channelsTable)
        .set({
          viewerCount: fastpixViewerCount,
          peakViewerCount: sql`GREATEST(${channelsTable.peakViewerCount}, ${fastpixViewerCount})`,
        })
        .where(eq(channelsTable.id, channelId));
      res.json({ viewerCount: fastpixViewerCount, isLive: true });
      return;
    }

    res.json({ viewerCount: channel.viewerCount, isLive: true });
  },
);

export default router;

import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { clipsTable, db, categoriesTable, channelsTable, followsTable, videosTable } from "@workspace/db";
import { GetDiscoverSummaryResponse, SearchKryvQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";
import { toVideoSummary } from "../lib/videoSerializer";
import { getFastPixViewerCount } from "../lib/fastpix";
import { readSharedJson, writeSharedJson } from "../lib/realtime";

const router: IRouter = Router();
const DISCOVER_SUMMARY_CACHE_KEY = "kryv:discover:summary:v1";

function rankLiveCandidate(channel: typeof channelsTable.$inferSelect) {
  // Candidate generation intentionally stays bounded and explainable until Kryv has
  // consented, inventory-rich engagement data for a real recommendation model.
  const popularity = Math.log2(Math.max(0, channel.viewerCount) + 1) * 100;
  const freshnessMinutes = channel.lastStreamAt
    ? Math.max(0, (Date.now() - channel.lastStreamAt.getTime()) / 60_000)
    : 180;
  const freshness = Math.max(0, 30 - Math.min(30, freshnessMinutes));
  const consistency = Math.min(20, Math.log2(Math.max(0, channel.peakViewerCount) + 1) * 3);
  return popularity + freshness + consistency;
}

function normalizedSearchTerm(query: string) {
  // Preserve ordinary natural-language search while preventing wildcard-only scans.
  return query.trim().replace(/[\\%_]/g, "").replace(/\s+/g, " ").slice(0, 64);
}

router.get("/discover/summary", async (_req, res): Promise<void> => {
  const cached = await readSharedJson<unknown>(DISCOVER_SUMMARY_CACHE_KEY);
  const cachedResponse = cached ? GetDiscoverSummaryResponse.safeParse(cached) : null;
  if (cachedResponse?.success) {
    res.json(cachedResponse.data);
    return;
  }

  const persistedLiveChannels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.isLive, true))
    .orderBy(desc(channelsTable.viewerCount))
    .limit(200);

  // FastPix owns concurrent-viewer measurement. Refresh the small live set here
  // before ranking the public directory, using the helper's 10-second cache.
  const liveChannels = await Promise.all(
    persistedLiveChannels.map(async (channel) => {
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
  liveChannels.sort((a, b) => {
    const scoreDifference = rankLiveCandidate(b) - rankLiveCandidate(a);
    return scoreDifference !== 0 ? scoreDifference : b.viewerCount - a.viewerCount;
  });

  const featuredChannels = await Promise.all(
    liveChannels.slice(0, 8).map(toChannelSummary),
  );

  const categories = await db.select().from(categoriesTable);
  const topCategories = await Promise.all(
    categories.slice(0, 8).map(async (category) => {
      const channelsInCategory = liveChannels.filter(
        (c) => c.categoryId === category.id,
      );
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        kind: category.kind as "live_game" | "genre",
        imageUrl: category.imageUrl,
        liveChannelCount: channelsInCategory.length,
        viewerCount: channelsInCategory.reduce(
          (sum, c) => sum + c.viewerCount,
          0,
        ),
      };
    }),
  );

  const totalViewers = liveChannels.reduce((sum, c) => sum + c.viewerCount, 0);

  const response = GetDiscoverSummaryResponse.parse({
    featuredChannels,
    topCategories,
    totalLiveChannels: liveChannels.length,
    totalViewers,
  });
  // Viewer counts remain provider-authoritative. The short cache only collapses
  // simultaneous public-directory refreshes across the control-plane instances.
  writeSharedJson(DISCOVER_SUMMARY_CACHE_KEY, response, 10).catch(() => undefined);
  res.json(response);
});

router.get("/search", async (req, res): Promise<void> => {
  const params = SearchKryvQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const term = normalizedSearchTerm(params.data.q);
  if (term.length < 2) {
    res.status(400).json({ error: "Search for at least two letters or numbers." });
    return;
  }
  const pattern = `%${term}%`;

  const [channels, videos, clips] = await Promise.all([
    db.select().from(channelsTable).where(or(ilike(channelsTable.displayName, pattern), ilike(channelsTable.slug, pattern), ilike(channelsTable.streamTitle, pattern))).orderBy(desc(channelsTable.isLive), desc(channelsTable.viewerCount)).limit(8),
    db.select().from(videosTable).where(and(eq(videosTable.uploadStatus, "ready"), ilike(videosTable.title, pattern))).orderBy(desc(videosTable.createdAt)).limit(8),
    db.select({ clip: clipsTable, channel: { id: channelsTable.id, displayName: channelsTable.displayName, slug: channelsTable.slug } }).from(clipsTable).innerJoin(channelsTable, eq(clipsTable.channelId, channelsTable.id)).where(and(eq(clipsTable.isPublished, true), eq(clipsTable.processingStatus, "ready"), ilike(clipsTable.title, pattern))).orderBy(desc(clipsTable.createdAt)).limit(8),
  ]);

  res.json({
    channels: await Promise.all(channels.map(toChannelSummary)),
    videos: await Promise.all(videos.map(toVideoSummary)),
    clips: clips.map(({ clip, channel }) => ({
      id: clip.id,
      title: clip.title,
      thumbnailUrl: clip.thumbnailUrl,
      durationSeconds: clip.durationSeconds,
      viewCount: clip.viewCount,
      channelId: channel.id,
      channelName: channel.displayName,
      channelSlug: channel.slug,
      processingStatus: "ready",
      playbackId: clip.fastpixPlaybackId,
      createdAt: clip.createdAt,
    })),
  });
});

router.get("/me/followed/live", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({ channel: channelsTable })
    .from(followsTable)
    .innerJoin(channelsTable, eq(followsTable.channelId, channelsTable.id))
    .where(and(eq(followsTable.followerUserId, req.user!.userId), eq(channelsTable.isLive, true)))
    .orderBy(desc(channelsTable.viewerCount))
    .limit(50);

  res.json(await Promise.all(rows.map(({ channel }) => toChannelSummary(channel))));
});

export default router;

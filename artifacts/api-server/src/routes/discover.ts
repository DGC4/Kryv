import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { clipsTable, db, categoriesTable, channelsTable, followsTable, videosTable } from "@workspace/db";
import { GetDiscoverSummaryResponse, SearchKryvQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";
import { toVideoSummary } from "../lib/videoSerializer";
import { getFastPixViewerCount } from "../lib/fastpix";

const router: IRouter = Router();

function normalizedSearchTerm(query: string) {
  // Preserve ordinary natural-language search while preventing wildcard-only scans.
  return query.trim().replace(/[\\%_]/g, "").replace(/\s+/g, " ").slice(0, 64);
}

router.get("/discover/summary", async (_req, res): Promise<void> => {
  const persistedLiveChannels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.isLive, true))
    .orderBy(desc(channelsTable.viewerCount));

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
  liveChannels.sort((a, b) => b.viewerCount - a.viewerCount);

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

  res.json(
    GetDiscoverSummaryResponse.parse({
      featuredChannels,
      topCategories,
      totalLiveChannels: liveChannels.length,
      totalViewers,
    }),
  );
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

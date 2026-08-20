import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { clipsTable, db, categoriesTable, channelsTable, followsTable, videosTable } from "@workspace/db";
import { GetDiscoverSummaryResponse, SearchKryvQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toChannelSummaries } from "../lib/channelSerializer";
import { toVideoSummaryFromRelations } from "../lib/videoSerializer";
import { readSharedJson, writeSharedJson } from "../lib/realtime";
import { getPublishedCinemaTitles } from "../lib/cinemaCatalog";
import { getActiveProfileMaturity } from "../lib/liveMaturity";
import { literalIlikePattern } from "../lib/search";
import { refreshLiveChannelViewerCounts } from "../lib/liveViewerRefresh";

const router: IRouter = Router();
const DISCOVER_SUMMARY_CACHE_KEY = "kryv:discover:summary:v1";
let discoverSummaryRefresh: Promise<
  ReturnType<typeof GetDiscoverSummaryResponse.parse>
> | null = null;

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
  const cachedResponse = cached
    ? GetDiscoverSummaryResponse.safeParse(cached)
    : null;
  if (cachedResponse?.success) {
    res.json(cachedResponse.data);
    return;
  }

  if (!discoverSummaryRefresh) {
    discoverSummaryRefresh = (async () => {
      const persistedLiveChannels = await db
        .select()
        .from(channelsTable)
        .where(eq(channelsTable.isLive, true))
        .orderBy(desc(channelsTable.viewerCount))
        .limit(200);

      // FastPix owns concurrent-viewer measurement. Refresh the bounded live set before
      // ranking the public directory, but cap concurrent provider requests and writes.
      const liveChannels = await refreshLiveChannelViewerCounts(
        persistedLiveChannels,
      );
      // This response is cached across viewers, so mature rooms never enter the
      // shared public payload. Profile-eligible discovery remains available through
      // the non-cached, profile-aware Live directory endpoint.
      const visibleLiveChannels = liveChannels.filter(
        (channel) => !channel.matureContent,
      );
      visibleLiveChannels.sort((a, b) => {
        const scoreDifference = rankLiveCandidate(b) - rankLiveCandidate(a);
        return scoreDifference !== 0
          ? scoreDifference
          : b.viewerCount - a.viewerCount;
      });

      const featuredChannels = await toChannelSummaries(
        visibleLiveChannels.slice(0, 8),
      );

      const categories = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.kind, "live_game"));
      const topCategories = categories
        .map((category) => {
          const channelsInCategory = visibleLiveChannels.filter(
            (channel) => channel.categoryId === category.id,
          );
          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            kind: "live_game" as const,
            imageUrl: category.imageUrl,
            liveChannelCount: channelsInCategory.length,
            viewerCount: channelsInCategory.reduce(
              (sum, channel) => sum + channel.viewerCount,
              0,
            ),
          };
        })
        .filter((category) => category.liveChannelCount > 0)
        .sort(
          (left, right) =>
            right.viewerCount - left.viewerCount
            || right.liveChannelCount - left.liveChannelCount
            || left.name.localeCompare(right.name),
        )
        .slice(0, 8);

      const totalViewers = visibleLiveChannels.reduce(
        (sum, channel) => sum + channel.viewerCount,
        0,
      );
      const response = GetDiscoverSummaryResponse.parse({
        featuredChannels,
        topCategories,
        totalLiveChannels: visibleLiveChannels.length,
        totalViewers,
      });
      // Viewer counts remain provider-authoritative. The short cache collapses public
      // directory refreshes across control-plane instances; this in-process promise
      // coalesces the cache-miss burst on the current instance.
      writeSharedJson(DISCOVER_SUMMARY_CACHE_KEY, response, 10).catch(
        () => undefined,
      );
      return response;
    })().finally(() => {
      discoverSummaryRefresh = null;
    });
  }
  res.json(await discoverSummaryRefresh);
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
  const pattern = literalIlikePattern(term);
  const profileMaturity = await getActiveProfileMaturity(req);
  const channelVisibilityCondition = profileMaturity === "mature"
    ? undefined
    : eq(channelsTable.matureContent, false);

  const [channels, videos, clips, cinemaCatalog] = await Promise.all([
    db
      .select()
      .from(channelsTable)
      .where(and(
        or(ilike(channelsTable.displayName, pattern), ilike(channelsTable.slug, pattern), ilike(channelsTable.streamTitle, pattern)),
        channelVisibilityCondition,
      ))
      .orderBy(desc(channelsTable.isLive), desc(channelsTable.viewerCount))
      .limit(8),
    db
      .select({
        video: videosTable,
        channel: {
          slug: channelsTable.slug,
          displayName: channelsTable.displayName,
          avatarUrl: channelsTable.avatarUrl,
        },
        categoryName: categoriesTable.name,
      })
      .from(videosTable)
      .innerJoin(channelsTable, eq(channelsTable.id, videosTable.channelId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, videosTable.categoryId))
      .where(
        and(
          eq(videosTable.contentType, "upload"),
          eq(videosTable.uploadStatus, "ready"),
          ilike(videosTable.title, pattern),
        ),
      )
      .orderBy(desc(videosTable.createdAt))
      .limit(8),
    db
      .select({ clip: clipsTable, channel: { id: channelsTable.id, displayName: channelsTable.displayName, slug: channelsTable.slug } })
      .from(clipsTable)
      .innerJoin(channelsTable, eq(clipsTable.channelId, channelsTable.id))
      .where(and(
        eq(clipsTable.isPublished, true),
        eq(clipsTable.processingStatus, "ready"),
        ilike(clipsTable.title, pattern),
        channelVisibilityCondition,
      ))
      .orderBy(desc(clipsTable.createdAt))
      .limit(8),
    getPublishedCinemaTitles(),
  ]);
  const cinema = cinemaCatalog.filter((title) => title.title.toLowerCase().includes(term) || title.synopsis?.toLowerCase().includes(term)).slice(0, 8);

  res.json({
    channels: await toChannelSummaries(channels),
    videos: videos.map((row) =>
      toVideoSummaryFromRelations(row.video, row.channel, row.categoryName),
    ),
    cinema,
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
  const profileMaturity = await getActiveProfileMaturity(req);
  const rows = await db
    .select({ channel: channelsTable })
    .from(followsTable)
    .innerJoin(channelsTable, eq(followsTable.channelId, channelsTable.id))
    .where(and(
      eq(followsTable.followerUserId, req.user!.userId),
      eq(channelsTable.isLive, true),
      profileMaturity === "mature" ? undefined : eq(channelsTable.matureContent, false),
    ))
    .orderBy(desc(channelsTable.viewerCount))
    .limit(50);

  res.json(await toChannelSummaries(rows.map(({ channel }) => channel)));
});

export default router;

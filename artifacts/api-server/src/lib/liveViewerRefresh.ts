import { eq, sql } from "drizzle-orm";
import { channelsTable, db } from "@workspace/db";
import { getFastPixViewerCount } from "./fastpix";

export const LIVE_VIEWER_REFRESH_CONCURRENCY = 12;

type LiveChannelRow = typeof channelsTable.$inferSelect;

/**
 * Refresh persisted viewer counts through FastPix without allowing a public directory
 * request to fan out into one simultaneous provider call per live channel.
 */
export async function refreshLiveChannelViewerCounts(
  channels: LiveChannelRow[],
): Promise<LiveChannelRow[]> {
  const refreshed = [...channels];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < channels.length) {
      const index = nextIndex;
      nextIndex += 1;
      const channel = channels[index];
      if (!channel?.fastpixLiveStreamId) continue;

      const viewerCount = await getFastPixViewerCount(
        channel.fastpixLiveStreamId,
      );
      if (viewerCount === null || viewerCount === channel.viewerCount) continue;

      await db
        .update(channelsTable)
        .set({
          viewerCount,
          peakViewerCount: sql`GREATEST(${channelsTable.peakViewerCount}, ${viewerCount})`,
        })
        .where(eq(channelsTable.id, channel.id));
      refreshed[index] = {
        ...channel,
        viewerCount,
        peakViewerCount: Math.max(channel.peakViewerCount, viewerCount),
      };
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(LIVE_VIEWER_REFRESH_CONCURRENCY, channels.length) },
      worker,
    ),
  );
  return refreshed;
}

import { eq } from "drizzle-orm";
import {
  db,
  categoriesTable,
  channelsTable,
  type Video,
} from "@workspace/db";
import { categoryNameFor } from "./channelSerializer";

export async function toVideoSummary(video: Video) {
  const [channel, categoryName] = await Promise.all([
    db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, video.channelId))
      .then((rows) => rows[0]),
    categoryNameFor(video.categoryId),
  ]);

  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    posterUrl: video.posterUrl,
    backdropUrl: video.backdropUrl,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    channelId: video.channelId,
    channelSlug: channel?.slug ?? "unknown",
    channelName: channel?.displayName ?? "Unknown",
    channelAvatarUrl: channel?.avatarUrl ?? null,
    categoryId: video.categoryId,
    categoryName,
    contentType: video.contentType as "upload" | "original",
    playbackId: video.fastpixPlaybackId,
    fastpixPlaybackId: video.fastpixPlaybackId,
    uploadStatus: video.uploadStatus as
      | "waiting"
      | "processing"
      | "ready"
      | "errored",
    createdAt: video.createdAt,
  };
}

export async function toVideoDetail(
  video: Video,
  viewerUserId: number | undefined,
) {
  const summary = await toVideoSummary(video);
  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.id, video.channelId));
  return {
    ...summary,
    description: video.description,
    isOwner: !!viewerUserId && viewerUserId === channel?.ownerUserId,
  };
}

// Unused import guard (kept for future genre-based grouping helpers).
export { categoriesTable };

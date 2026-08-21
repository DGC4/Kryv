import { asc, eq } from "drizzle-orm";
import {
  db,
  categoriesTable,
  channelsTable,
  videoMusicCreditsTable,
  type Channel,
  type Video,
  type VideoMusicCredit,
} from "@workspace/db";
type VideoSummaryChannel =
  | Pick<Channel, "slug" | "displayName" | "avatarUrl">
  | null
  | undefined;

export const MAX_VIDEO_MUSIC_CREDITS = 20;

function publicPlaybackSource(video: Video): "fastpix" | "youtube" {
  // `playback_source` was introduced after early Watch records existed and is
  // stored as unconstrained text. A YouTube response is valid only when an
  // actual official embed identifier accompanies it; every other persisted
  // value remains on Kryv's processed FastPix path.
  return video.playbackSource === "youtube" && Boolean(video.youtubeVideoId?.trim())
    ? "youtube"
    : "fastpix";
}

export function toVideoSummaryFromRelations(
  video: Video,
  channel: VideoSummaryChannel,
  categoryName: string | null,
) {
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
    playbackSource: publicPlaybackSource(video),
    youtubeVideoId: video.youtubeVideoId,
    uploadStatus: video.uploadStatus as
      | "waiting"
      | "processing"
      | "ready"
      | "errored",
    createdAt: video.createdAt,
  };
}

export async function toVideoSummary(video: Video) {
  const [channel, category] = await Promise.all([
    db
      .select({
        slug: channelsTable.slug,
        displayName: channelsTable.displayName,
        avatarUrl: channelsTable.avatarUrl,
      })
      .from(channelsTable)
      .where(eq(channelsTable.id, video.channelId))
      .then((rows) => rows[0]),
    video.categoryId === null
      ? Promise.resolve(null)
      : db
          .select({ name: categoriesTable.name })
          .from(categoriesTable)
          .where(eq(categoriesTable.id, video.categoryId))
          .then((rows) => rows[0] ?? null),
  ]);

  return toVideoSummaryFromRelations(video, channel, category?.name ?? null);
}

export function toVideoMusicCredit(credit: VideoMusicCredit) {
  return {
    id: credit.id,
    trackTitle: credit.trackTitle,
    artistName: credit.artistName,
    albumTitle: credit.albumTitle,
    labelName: credit.labelName,
    artworkUrl: credit.artworkUrl,
    sourceUrl: credit.sourceUrl,
    musicbrainzRecordingId: credit.musicbrainzRecordingId,
    musicbrainzReleaseId: credit.musicbrainzReleaseId,
    metadataSource: credit.metadataSource === "musicbrainz" ? "musicbrainz" as const : "publisher_attested" as const,
    rightsAttestedAt: credit.rightsAttestedAt,
    displayOrder: credit.displayOrder,
  };
}

type VideoDetailRelations = {
  channel: Channel;
  categoryName: string | null;
};

export async function toVideoDetail(
  video: Video,
  viewerUserId: number | undefined,
  relations?: VideoDetailRelations,
) {
  const [channel, categoryName, musicCredits] = await Promise.all([
    relations
      ? Promise.resolve(relations.channel)
      : db
          .select()
          .from(channelsTable)
          .where(eq(channelsTable.id, video.channelId))
          .then((rows) => rows[0]),
    relations
      ? Promise.resolve(relations.categoryName)
      : video.categoryId === null
        ? Promise.resolve(null)
        : db
            .select({ name: categoriesTable.name })
            .from(categoriesTable)
            .where(eq(categoriesTable.id, video.categoryId))
            .then((rows) => rows[0]?.name ?? null),
    db
      .select()
      .from(videoMusicCreditsTable)
      .where(eq(videoMusicCreditsTable.videoId, video.id))
      .orderBy(asc(videoMusicCreditsTable.displayOrder), asc(videoMusicCreditsTable.createdAt))
      .limit(MAX_VIDEO_MUSIC_CREDITS),
  ]);
  const summary = toVideoSummaryFromRelations(video, channel, categoryName);
  return {
    ...summary,
    description: video.description,
    isOwner: !!viewerUserId && viewerUserId === channel?.ownerUserId,
    musicCredits: musicCredits.map(toVideoMusicCredit),
  };
}

// Unused import guard (kept for future genre-based grouping helpers).
export { categoriesTable };

import { asc, eq } from "drizzle-orm";
import {
  db,
  categoriesTable,
  channelsTable,
  videoMusicCreditsTable,
  type Video,
  type VideoMusicCredit,
} from "@workspace/db";
import { categoryNameFor } from "./channelSerializer";

function publicPlaybackSource(video: Video): "fastpix" | "youtube" {
  // `playback_source` was introduced after early Watch records existed and is
  // stored as unconstrained text. A YouTube response is valid only when an
  // actual official embed identifier accompanies it; every other persisted
  // value remains on Kryv's processed FastPix path.
  return video.playbackSource === "youtube" && Boolean(video.youtubeVideoId?.trim())
    ? "youtube"
    : "fastpix";
}

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

export async function toVideoDetail(
  video: Video,
  viewerUserId: number | undefined,
) {
  const summary = await toVideoSummary(video);
  const [channel, musicCredits] = await Promise.all([
    db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, video.channelId))
      .then((rows) => rows[0]),
    db
      .select()
      .from(videoMusicCreditsTable)
      .where(eq(videoMusicCreditsTable.videoId, video.id))
      .orderBy(asc(videoMusicCreditsTable.displayOrder), asc(videoMusicCreditsTable.createdAt)),
  ]);
  return {
    ...summary,
    description: video.description,
    isOwner: !!viewerUserId && viewerUserId === channel?.ownerUserId,
    musicCredits: musicCredits.map(toVideoMusicCredit),
  };
}

// Unused import guard (kept for future genre-based grouping helpers).
export { categoriesTable };

import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";
import { videosTable } from "./videos";
import { usersTable } from "./users";

/**
 * Owner-published music acknowledgements for a Kryv Watch release.
 *
 * A row is visible only because the release owner has explicitly attested that
 * the credit and any linked artwork/source are appropriate to display. A
 * metadata reference helps viewers verify provenance, but never grants Kryv
 * publishing rights for the underlying recording.
 */
export const videoMusicCreditsTable = pgTable("video_music_credits", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videosTable.id, { onDelete: "cascade" }),
  trackTitle: text("track_title").notNull(),
  artistName: text("artist_name").notNull(),
  albumTitle: text("album_title"),
  labelName: text("label_name"),
  artworkUrl: text("artwork_url"),
  sourceUrl: text("source_url"),
  musicbrainzRecordingId: text("musicbrainz_recording_id"),
  musicbrainzReleaseId: text("musicbrainz_release_id"),
  metadataSource: text("metadata_source").notNull().default("publisher_attested"),
  rightsAttestedAt: timestamp("rights_attested_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUserId: integer("created_by_user_id")
    .references(() => usersTable.id, { onDelete: "set null" }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  videoOrderIdx: index("video_music_credits_video_order_idx")
    .on(table.videoId, table.displayOrder, table.createdAt),
  videoRecordingUnique: uniqueIndex("video_music_credits_video_recording_unique")
    .on(table.videoId, table.musicbrainzRecordingId)
    .where(isNotNull(table.musicbrainzRecordingId)),
}));

export type VideoMusicCredit = typeof videoMusicCreditsTable.$inferSelect;

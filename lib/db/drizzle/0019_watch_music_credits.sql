-- Owner-attested music acknowledgement records for Kryv Watch releases.
-- These credits explain a published recording; they do not establish playback,
-- synchronization, publishing, or catalog rights for the underlying work.
CREATE TABLE IF NOT EXISTS video_music_credits (
  id serial PRIMARY KEY,
  video_id integer NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  album_title text,
  label_name text,
  artwork_url text,
  source_url text,
  musicbrainz_recording_id text,
  musicbrainz_release_id text,
  metadata_source text NOT NULL DEFAULT 'publisher_attested',
  rights_attested_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_music_credits_video_order_idx
  ON video_music_credits (video_id, display_order, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS video_music_credits_video_recording_unique
  ON video_music_credits (video_id, musicbrainz_recording_id)
  WHERE musicbrainz_recording_id IS NOT NULL;

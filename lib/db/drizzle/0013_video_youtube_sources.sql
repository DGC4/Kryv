-- Explicit source metadata for rights-cleared official YouTube embeds in Kryv Watch.
-- Cinema remains owner-controlled and is not opened to creator self-publishing.
ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS playback_source text NOT NULL DEFAULT 'fastpix';
ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS youtube_video_id text;
ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS rights_attested_at timestamptz;

CREATE INDEX IF NOT EXISTS videos_playback_source_idx
  ON videos (playback_source, created_at DESC);

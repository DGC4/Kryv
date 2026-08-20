-- Kryv Watch bounded catalog query indexes.
--
-- Supports the public ready-upload page ordered by created_at/id and creator-scoped
-- Watch/profile libraries without indexing Cinema originals. Validate on an isolated
-- Neon branch before any production rollout.

CREATE INDEX IF NOT EXISTS videos_ready_upload_created_idx
  ON videos (created_at DESC, id DESC)
  WHERE content_type = 'upload' AND upload_status = 'ready';

CREATE INDEX IF NOT EXISTS videos_watch_channel_created_idx
  ON videos (channel_id, created_at DESC, id DESC)
  WHERE content_type = 'upload';

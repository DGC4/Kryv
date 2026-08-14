-- Persistent, moderated discussion for ready Kryv Watch releases.
CREATE TABLE IF NOT EXISTS video_comments (
  id serial PRIMARY KEY,
  video_id integer NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id integer,
  message text NOT NULL,
  deleted_at timestamptz,
  deleted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_comments_message_length CHECK (char_length(message) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS video_comments_video_parent_created_idx
  ON video_comments (video_id, parent_comment_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS video_comments_channel_created_idx
  ON video_comments (channel_id, created_at DESC, id DESC);

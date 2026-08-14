-- Public discussion for published, owner-curated Cinema titles. This migration
-- adds viewer conversation only; it does not create a creator publishing path.
CREATE TABLE IF NOT EXISTS cinema_comments (
  id serial PRIMARY KEY,
  cinema_title_id integer NOT NULL REFERENCES cinema_titles(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id integer,
  message text NOT NULL,
  deleted_at timestamptz,
  deleted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cinema_comments_message_length CHECK (char_length(message) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS cinema_comments_title_parent_created_idx
  ON cinema_comments (cinema_title_id, parent_comment_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS cinema_comments_user_created_idx
  ON cinema_comments (user_id, created_at DESC, id DESC);

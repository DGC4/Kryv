-- Curated creator credits for owner-controlled Cinema titles.
-- This is additive and intentionally grants no creator catalog publication or asset-upload rights.
CREATE TABLE IF NOT EXISTS cinema_credits (
  id serial PRIMARY KEY,
  cinema_title_id integer NOT NULL REFERENCES cinema_titles(id) ON DELETE CASCADE,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cinema_credits_title_channel_role_unique
  ON cinema_credits (cinema_title_id, channel_id, role);
CREATE INDEX IF NOT EXISTS cinema_credits_channel_order_idx
  ON cinema_credits (channel_id, display_order, created_at);
CREATE INDEX IF NOT EXISTS cinema_credits_title_order_idx
  ON cinema_credits (cinema_title_id, display_order, created_at);

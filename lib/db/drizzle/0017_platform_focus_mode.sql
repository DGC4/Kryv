-- Owner-controlled public Focus Mode. This is a single safe presentation setting;
-- it does not create a new publishing right, payment path, custody record, or ad-delivery path.
CREATE TABLE IF NOT EXISTS platform_focus_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled boolean NOT NULL DEFAULT false,
  source_type text NOT NULL DEFAULT 'live' CHECK (source_type IN ('live', 'cinema')),
  live_channel_id integer REFERENCES channels(id) ON DELETE SET NULL,
  cinema_title_id integer REFERENCES cinema_titles(id) ON DELETE SET NULL,
  chat_enabled boolean NOT NULL DEFAULT true,
  announcement_text text,
  updated_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_focus_settings_announcement_length CHECK (announcement_text IS NULL OR char_length(announcement_text) <= 500),
  CONSTRAINT platform_focus_settings_source_shape CHECK (
    (source_type = 'live' AND cinema_title_id IS NULL)
    OR (source_type = 'cinema' AND live_channel_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS platform_focus_settings_live_channel_idx
  ON platform_focus_settings (live_channel_id)
  WHERE live_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_focus_settings_cinema_title_idx
  ON platform_focus_settings (cinema_title_id)
  WHERE cinema_title_id IS NOT NULL;

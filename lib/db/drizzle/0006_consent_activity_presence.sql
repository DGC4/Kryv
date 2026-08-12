-- Privacy-default, consent-gated Kryv in-app activity presence.
-- This does not store pixels, input values, payment data, routes outside Kryv, or raw screen capture.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS activity_observability_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_activity_presence (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  route_key text NOT NULL,
  device_class text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Keep the persistence layer as narrow as the public API contract. These checks are
-- intentionally duplicated from ActivityPresenceInput so future server changes cannot
-- accidentally persist raw routes, user input, or arbitrary device identifiers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_activity_presence_route_key_allowed'
      AND conrelid = 'user_activity_presence'::regclass
  ) THEN
    ALTER TABLE user_activity_presence
      ADD CONSTRAINT user_activity_presence_route_key_allowed
      CHECK (route_key IN (
        'live_home', 'live_categories', 'live_category', 'live_channel',
        'watch_home', 'watch_detail', 'clips_home', 'clip_detail',
        'cinema_catalog', 'cinema_detail', 'creator_studio', 'creator_wallet',
        'creator_achievements', 'account_settings'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_activity_presence_device_class_allowed'
      AND conrelid = 'user_activity_presence'::regclass
  ) THEN
    ALTER TABLE user_activity_presence
      ADD CONSTRAINT user_activity_presence_device_class_allowed
      CHECK (device_class IN ('desktop', 'tablet', 'mobile', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_activity_presence_updated_idx
  ON user_activity_presence (updated_at DESC);

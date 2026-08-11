ALTER TABLE channels ADD COLUMN IF NOT EXISTS chat_slow_mode_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS chat_followers_only boolean NOT NULL DEFAULT false;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx ON chat_messages(channel_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_channel_unique ON follows(follower_user_id, channel_id);
CREATE INDEX IF NOT EXISTS follows_follower_created_idx ON follows(follower_user_id, created_at DESC);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_price_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_id_unique ON subscriptions(provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_channel_user_unique ON subscriptions(user_id, channel_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS creator_payment_accounts (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_account_id text NOT NULL UNIQUE,
  onboarding_status text NOT NULL DEFAULT 'pending',
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  country text,
  requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_payment_accounts_onboarding_status_idx ON creator_payment_accounts(onboarding_status);

CREATE TABLE IF NOT EXISTS payment_events (
  id serial PRIMARY KEY,
  provider text NOT NULL DEFAULT 'stripe',
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processing_status text NOT NULL DEFAULT 'received',
  related_provider_account_id text,
  related_provider_payment_id text,
  error_code text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_status_created_idx ON payment_events(processing_status, created_at DESC);

ALTER TABLE clips ADD COLUMN IF NOT EXISTS fastpix_request_id text;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS fastpix_media_id text;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS fastpix_playback_id text;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processing';
ALTER TABLE clips ADD COLUMN IF NOT EXISTS processing_error text;
CREATE UNIQUE INDEX IF NOT EXISTS clips_fastpix_request_id_unique ON clips(fastpix_request_id) WHERE fastpix_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clips_fastpix_media_id_unique ON clips(fastpix_media_id) WHERE fastpix_media_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clips_channel_published_created_idx ON clips(channel_id, created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS clips_processing_status_idx ON clips(processing_status, created_at DESC);

CREATE INDEX IF NOT EXISTS moderators_channel_user_idx ON moderators(channel_id, user_id);
CREATE INDEX IF NOT EXISTS channel_bans_channel_user_expires_idx ON channel_bans(channel_id, user_id, expires_at);

ALTER TABLE tips ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';
ALTER TABLE tips ADD COLUMN IF NOT EXISTS provider_payment_intent_id text;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS platform_fee_amount numeric(10,2);
ALTER TABLE tips ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS tips_provider_payment_intent_unique ON tips(provider_payment_intent_id) WHERE provider_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS channel_points_channel_user_unique ON channel_points(channel_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_user_unique ON poll_votes(poll_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS prediction_entries_prediction_user_unique ON prediction_predictions(prediction_id, user_id);
CREATE INDEX IF NOT EXISTS chat_timeouts_channel_user_expires_idx ON chat_timeouts(channel_id, user_id, expires_at);
CREATE INDEX IF NOT EXISTS notification_preferences_user_channel_idx ON notification_preferences(user_id, channel_id);
CREATE UNIQUE INDEX IF NOT EXISTS videos_fastpix_asset_unique ON videos(fastpix_asset_id) WHERE fastpix_asset_id IS NOT NULL;

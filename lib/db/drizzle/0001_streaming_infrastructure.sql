-- Migration: 0001_streaming_infrastructure
-- Adds self-hosted stream key support and full Twitch/Kick-level infrastructure

-- ── channels: new columns ─────────────────────────────────────────────────
ALTER TABLE channels ADD COLUMN IF NOT EXISTS stream_key text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS rtmp_url text DEFAULT 'rtmp://global-live.mux.com:5222/app';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS stream_key_generated_at timestamp with time zone;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_stream_at timestamp with time zone;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS total_stream_count integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS peak_viewer_count integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS sub_count integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS mature_content boolean NOT NULL DEFAULT false;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_points_enabled boolean NOT NULL DEFAULT true;

-- ── stream_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_sessions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  peak_viewers integer NOT NULL DEFAULT 0,
  avg_viewers integer NOT NULL DEFAULT 0,
  total_views integer NOT NULL DEFAULT 0,
  stream_title text,
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  stream_key text,
  ingest_server text,
  rtmp_url text,
  was_live boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── channel_points ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_points (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  last_earned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- ── channel_point_rewards ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_point_rewards (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cost integer NOT NULL DEFAULT 100,
  is_enabled boolean NOT NULL DEFAULT true,
  is_paused boolean NOT NULL DEFAULT false,
  background_color text DEFAULT '#9147FF',
  image_url text,
  max_per_stream integer,
  max_per_user_per_stream integer,
  global_cooldown_seconds integer,
  auto_fulfill boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── channel_point_redemptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_point_redemptions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  reward_id integer NOT NULL REFERENCES channel_point_rewards(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_input text,
  status text NOT NULL DEFAULT 'unfulfilled',
  points_spent integer NOT NULL,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── raids ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raids (
  id serial PRIMARY KEY,
  from_channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  to_channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  viewer_count integer NOT NULL DEFAULT 0,
  raided_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── polls ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  duration_seconds integer NOT NULL DEFAULT 60,
  channel_points_voting_enabled boolean NOT NULL DEFAULT false,
  channel_points_per_vote integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── poll_choices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_choices (
  id serial PRIMARY KEY,
  poll_id integer NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  title text NOT NULL,
  votes integer NOT NULL DEFAULT 0,
  channel_points_votes integer NOT NULL DEFAULT 0
);

-- ── poll_votes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id serial PRIMARY KEY,
  poll_id integer NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  choice_id integer NOT NULL REFERENCES poll_choices(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_points_used integer NOT NULL DEFAULT 0,
  voted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- ── predictions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  winning_outcome_id integer,
  prediction_window_seconds integer NOT NULL DEFAULT 120,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── prediction_outcomes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_outcomes (
  id serial PRIMARY KEY,
  prediction_id integer NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  title text NOT NULL,
  color text NOT NULL DEFAULT 'BLUE',
  total_channel_points integer NOT NULL DEFAULT 0,
  total_users integer NOT NULL DEFAULT 0
);

-- ── prediction_bets ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_bets (
  id serial PRIMARY KEY,
  prediction_id integer NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  outcome_id integer NOT NULL REFERENCES prediction_outcomes(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_points integer NOT NULL,
  placed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(prediction_id, user_id)
);

-- ── clips ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clips (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  creator_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stream_session_id integer REFERENCES stream_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  thumbnail_url text,
  video_url text,
  duration_seconds integer NOT NULL DEFAULT 30,
  view_count integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── channel_moderators ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_moderators (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- ── channel_bans ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_bans (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  expires_at timestamp with time zone,
  is_permanent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- ── chat_timeouts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_timeouts (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timed_out_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  duration_seconds integer NOT NULL DEFAULT 600,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── chat_emotes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_emotes (
  id serial PRIMARY KEY,
  channel_id integer REFERENCES channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  is_animated boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, name)
);

-- ── chat_badges ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_badges (
  id serial PRIMARY KEY,
  channel_id integer REFERENCES channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  badge_type text NOT NULL DEFAULT 'custom',
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── stream_alerts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_alerts (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  message text,
  amount_cents integer,
  tier text,
  gift_count integer,
  triggered_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── hype_trains ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hype_trains (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  total_points integer NOT NULL DEFAULT 0,
  goal_points integer NOT NULL DEFAULT 1000,
  top_contributions jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  ended_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active'
);

-- ── channel_schedules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_schedules (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  timezone text DEFAULT 'UTC',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── viewer_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viewer_sessions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  session_token text,
  ip_address text,
  user_agent text,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  watch_time_seconds integer NOT NULL DEFAULT 0
);

-- ── channel_vips ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_vips (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- ── channel_tags ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_tags (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, tag)
);

-- ── channel_goals ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_goals (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  title text NOT NULL,
  current_amount integer NOT NULL DEFAULT 0,
  target_amount integer NOT NULL,
  is_achieved boolean NOT NULL DEFAULT false,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone
);

-- ── channel_charity_campaigns ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_charity_campaigns (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  charity_name text NOT NULL,
  charity_description text,
  charity_logo_url text,
  current_amount_cents integer NOT NULL DEFAULT 0,
  target_amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone
);

-- ── channel_extensions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_extensions (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  extension_id text NOT NULL,
  extension_name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  slot text NOT NULL DEFAULT 'panel',
  is_active boolean NOT NULL DEFAULT true,
  config jsonb,
  installed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, extension_id)
);

-- ── channel_panels ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_panels (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text,
  content text,
  image_url text,
  link_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  action_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── user_blocked_channels ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_blocked_channels (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- ── user_preferences ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  notify_on_live boolean NOT NULL DEFAULT true,
  notify_on_clips boolean NOT NULL DEFAULT true,
  mature_content_filter boolean NOT NULL DEFAULT true,
  autoplay boolean NOT NULL DEFAULT true,
  chat_sound boolean NOT NULL DEFAULT false,
  theme text DEFAULT 'dark',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── stream_markers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_markers (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  stream_session_id integer REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description text,
  position_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── channel_automod_settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_automod_settings (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  overall_level integer NOT NULL DEFAULT 0,
  aggression integer NOT NULL DEFAULT 0,
  bullying integer NOT NULL DEFAULT 0,
  disability integer NOT NULL DEFAULT 0,
  misogyny integer NOT NULL DEFAULT 0,
  race_ethnicity_religion integer NOT NULL DEFAULT 0,
  sex_based_terms integer NOT NULL DEFAULT 0,
  sexuality_sex_gender integer NOT NULL DEFAULT 0,
  swearing integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── channel_blocked_terms ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_blocked_terms (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  term text NOT NULL,
  is_regex boolean NOT NULL DEFAULT false,
  added_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, term)
);

-- ── channel_chat_settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_chat_settings (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  emote_only_mode boolean NOT NULL DEFAULT false,
  follower_only_mode boolean NOT NULL DEFAULT false,
  follower_only_duration_minutes integer NOT NULL DEFAULT 0,
  subscriber_only_mode boolean NOT NULL DEFAULT false,
  slow_mode boolean NOT NULL DEFAULT false,
  slow_mode_wait_seconds integer NOT NULL DEFAULT 30,
  unique_chat_mode boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── stream_categories_history ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_categories_history (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

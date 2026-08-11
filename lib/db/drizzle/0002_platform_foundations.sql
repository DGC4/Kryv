-- Kryv platform foundations: profiles, Cinema publishing, advertising, commerce, and auditability.
-- This migration is additive and intentionally does not alter the working FastPix live-stream path.

-- ── Cinema catalog ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cinema_titles (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  synopsis text,
  release_year integer,
  runtime_seconds integer,
  content_rating text,
  maturity_level text NOT NULL DEFAULT 'standard',
  genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  cast_members jsonb NOT NULL DEFAULT '[]'::jsonb,
  crew jsonb NOT NULL DEFAULT '[]'::jsonb,
  poster_url text,
  backdrop_url text,
  logo_url text,
  publish_state text NOT NULL DEFAULT 'draft',
  editorial_rank integer NOT NULL DEFAULT 0,
  ad_eligible boolean NOT NULL DEFAULT false,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cinema_titles_published_rank_idx
  ON cinema_titles (publish_state, editorial_rank, published_at);
CREATE INDEX IF NOT EXISTS cinema_titles_created_idx ON cinema_titles (created_at);

CREATE TABLE IF NOT EXISTS cinema_title_assets (
  id serial PRIMARY KEY,
  cinema_title_id integer NOT NULL REFERENCES cinema_titles(id) ON DELETE CASCADE,
  asset_kind text NOT NULL,
  fastpix_media_id text UNIQUE,
  fastpix_playback_id text,
  fastpix_upload_id text,
  processing_status text NOT NULL DEFAULT 'waiting',
  processing_error text,
  source_provenance text,
  source_checksum text,
  language text NOT NULL DEFAULT 'en',
  duration_seconds integer,
  approved_at timestamp with time zone,
  approved_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cinema_title_assets_title_kind_idx
  ON cinema_title_assets (cinema_title_id, asset_kind);
CREATE INDEX IF NOT EXISTS cinema_title_assets_processing_idx
  ON cinema_title_assets (processing_status, created_at);

CREATE TABLE IF NOT EXISTS cinema_rights_windows (
  id serial PRIMARY KEY,
  cinema_title_id integer NOT NULL REFERENCES cinema_titles(id) ON DELETE CASCADE,
  territory_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  entitlement_type text NOT NULL DEFAULT 'free',
  rights_reference text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cinema_rights_windows_title_start_idx
  ON cinema_rights_windows (cinema_title_id, starts_at);

-- ── Viewer profiles and personal viewing state ───────────────────────────────
CREATE TABLE IF NOT EXISTS viewer_profiles (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text,
  pin_hash text,
  maturity_level text NOT NULL DEFAULT 'standard',
  is_kids_profile boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS viewer_profiles_user_idx ON viewer_profiles (user_id, created_at);

CREATE TABLE IF NOT EXISTS profile_watch_states (
  id serial PRIMARY KEY,
  profile_id integer NOT NULL REFERENCES viewer_profiles(id) ON DELETE CASCADE,
  video_id integer REFERENCES videos(id) ON DELETE CASCADE,
  cinema_title_id integer REFERENCES cinema_titles(id) ON DELETE CASCADE,
  progress_seconds integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  completed_at timestamp with time zone,
  last_watched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_watch_states_target_check CHECK (video_id IS NOT NULL OR cinema_title_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS profile_watch_states_recent_idx
  ON profile_watch_states (profile_id, last_watched_at);
CREATE UNIQUE INDEX IF NOT EXISTS profile_watch_states_profile_video_unique
  ON profile_watch_states (profile_id, video_id) WHERE video_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profile_watch_states_profile_cinema_unique
  ON profile_watch_states (profile_id, cinema_title_id) WHERE cinema_title_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS profile_my_list (
  id serial PRIMARY KEY,
  profile_id integer NOT NULL REFERENCES viewer_profiles(id) ON DELETE CASCADE,
  cinema_title_id integer NOT NULL REFERENCES cinema_titles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(profile_id, cinema_title_id)
);
CREATE INDEX IF NOT EXISTS profile_my_list_profile_created_idx ON profile_my_list (profile_id, created_at);

-- ── Channel access and case management ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_roles (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'moderator',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  revoked_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS channel_roles_channel_active_idx ON channel_roles (channel_id, revoked_at);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id serial PRIMARY KEY,
  channel_id integer REFERENCES channels(id) ON DELETE CASCADE,
  reporter_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  case_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  summary text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  resolution text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_cases_status_created_idx ON moderation_cases (status, created_at);
CREATE INDEX IF NOT EXISTS moderation_cases_channel_status_idx ON moderation_cases (channel_id, status);

-- ── Consent and advertising inventory ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_preferences (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  region_code text,
  granted boolean NOT NULL DEFAULT false,
  legal_document_version text NOT NULL,
  granted_at timestamp with time zone,
  withdrawn_at timestamp with time zone,
  source text NOT NULL DEFAULT 'web',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, purpose)
);
CREATE INDEX IF NOT EXISTS consent_preferences_purpose_granted_idx
  ON consent_preferences (purpose, granted);

CREATE TABLE IF NOT EXISTS consent_receipts (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  purpose text NOT NULL,
  granted boolean NOT NULL,
  region_code text,
  legal_document_version text NOT NULL,
  source text NOT NULL DEFAULT 'web',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_receipts_user_purpose_created_idx
  ON consent_receipts (user_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id serial PRIMARY KEY,
  name text NOT NULL,
  advertiser_name text,
  campaign_type text NOT NULL DEFAULT 'house',
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  targeting jsonb NOT NULL DEFAULT '{}'::jsonb,
  frequency_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_campaigns_status_window_idx ON ad_campaigns (status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_creatives (
  id serial PRIMARY KEY,
  campaign_id integer NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  creative_type text NOT NULL,
  label text NOT NULL,
  asset_url text NOT NULL,
  duration_seconds integer,
  landing_url text,
  status text NOT NULL DEFAULT 'draft',
  content_rating text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_creatives_campaign_status_idx ON ad_creatives (campaign_id, status);

CREATE TABLE IF NOT EXISTS ad_rules (
  id serial PRIMARY KEY,
  campaign_id integer REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  surface text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  pre_roll_enabled boolean NOT NULL DEFAULT false,
  mid_roll_enabled boolean NOT NULL DEFAULT false,
  post_roll_enabled boolean NOT NULL DEFAULT false,
  min_minutes_between_breaks integer,
  max_pod_duration_seconds integer,
  creator_can_defer boolean NOT NULL DEFAULT false,
  creator_can_trigger boolean NOT NULL DEFAULT false,
  targeting jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_rules_surface_status_idx ON ad_rules (surface, status);
CREATE INDEX IF NOT EXISTS ad_rules_campaign_status_idx ON ad_rules (campaign_id, status);

CREATE TABLE IF NOT EXISTS ad_breaks (
  id serial PRIMARY KEY,
  ad_rule_id integer REFERENCES ad_rules(id) ON DELETE SET NULL,
  channel_id integer REFERENCES channels(id) ON DELETE CASCADE,
  video_id integer REFERENCES videos(id) ON DELETE CASCADE,
  cinema_title_id integer REFERENCES cinema_titles(id) ON DELETE CASCADE,
  surface text NOT NULL,
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  deferred_until timestamp with time zone,
  max_pod_duration_seconds integer,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_breaks_surface_status_schedule_idx ON ad_breaks (surface, status, scheduled_at);
CREATE INDEX IF NOT EXISTS ad_breaks_channel_created_idx ON ad_breaks (channel_id, created_at);

CREATE TABLE IF NOT EXISTS ad_impressions (
  id serial PRIMARY KEY,
  ad_break_id integer NOT NULL REFERENCES ad_breaks(id) ON DELETE CASCADE,
  creative_id integer REFERENCES ad_creatives(id) ON DELETE SET NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  profile_id integer REFERENCES viewer_profiles(id) ON DELETE SET NULL,
  delivery_status text NOT NULL DEFAULT 'requested',
  qualified_at timestamp with time zone,
  completed_at timestamp with time zone,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_impressions_break_delivery_idx ON ad_impressions (ad_break_id, delivery_status);
CREATE INDEX IF NOT EXISTS ad_impressions_user_created_idx ON ad_impressions (user_id, created_at);

-- ── Provider-neutral commerce ledger ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_intents (
  id serial PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  purchaser_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  receiver_channel_id integer REFERENCES channels(id) ON DELETE SET NULL,
  payment_kind text NOT NULL,
  provider text NOT NULL,
  provider_payment_id text UNIQUE,
  source_amount numeric(18, 8) NOT NULL,
  source_currency text NOT NULL,
  selected_currency text,
  status text NOT NULL DEFAULT 'created',
  expires_at timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_intents_provider_status_idx ON payment_intents (provider, status, created_at);
CREATE INDEX IF NOT EXISTS payment_intents_receiver_created_idx ON payment_intents (receiver_channel_id, created_at);

CREATE TABLE IF NOT EXISTS creator_balances (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  currency text NOT NULL,
  pending_amount numeric(18, 8) NOT NULL DEFAULT 0,
  available_amount numeric(18, 8) NOT NULL DEFAULT 0,
  held_amount numeric(18, 8) NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, currency)
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  requested_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  amount numeric(18, 8) NOT NULL,
  destination_reference text,
  provider text,
  provider_payout_id text UNIQUE,
  status text NOT NULL DEFAULT 'requested',
  risk_hold_reason text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone
);
CREATE INDEX IF NOT EXISTS payout_requests_channel_status_idx ON payout_requests (channel_id, status, requested_at);

CREATE TABLE IF NOT EXISTS payout_approvals (
  id serial PRIMARY KEY,
  payout_request_id integer NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
  reviewer_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision text NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_approvals_payout_created_idx ON payout_approvals (payout_request_id, created_at);

-- ── Owner operations and append-only auditability ─────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  session_id text,
  ip_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_target_created_idx ON audit_logs (target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs (actor_user_id, created_at);

CREATE TABLE IF NOT EXISTS feature_flags (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  rollout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Safety default: all monetization and new high-impact delivery systems remain
-- explicitly disabled until their server-backed implementations and provider setup
-- have passed verification.
INSERT INTO feature_flags (key, description, enabled)
VALUES
  ('cinema_catalog_v2', 'Enables the new owner-governed Cinema catalog workflow.', false),
  ('ads_delivery', 'Enables production ad decisioning and delivery.', false),
  ('crypto_commerce', 'Enables live crypto invoices, entitlements, and payouts.', false),
  ('owner_control_v2', 'Enables the expanded owner operations console.', false)
ON CONFLICT (key) DO NOTHING;

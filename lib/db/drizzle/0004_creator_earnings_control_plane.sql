-- Kryv creator earnings, payout profile, cadence, and owner finance command foundation.
-- Forward-only: existing creator balance projections and payout records remain intact.

CREATE TABLE IF NOT EXISTS creator_balance_movements (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  currency text NOT NULL,
  movement_type text NOT NULL,
  available_delta numeric(18, 8) NOT NULL DEFAULT 0,
  held_delta numeric(18, 8) NOT NULL DEFAULT 0,
  pending_delta numeric(18, 8) NOT NULL DEFAULT 0,
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_balance_movements_channel_created_idx
  ON creator_balance_movements (channel_id, created_at);
CREATE INDEX IF NOT EXISTS creator_balance_movements_source_idx
  ON creator_balance_movements (source_type, source_id);

CREATE TABLE IF NOT EXISTS creator_payout_profiles (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  currency text NOT NULL,
  address_ciphertext text NOT NULL,
  address_iv text NOT NULL,
  address_auth_tag text NOT NULL,
  address_digest text NOT NULL,
  address_masked text NOT NULL,
  key_version text NOT NULL DEFAULT 'v1',
  confirmation_status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamp with time zone,
  reviewed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  review_status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, currency)
);
CREATE INDEX IF NOT EXISTS creator_payout_profiles_review_status_idx
  ON creator_payout_profiles (review_status, updated_at);

CREATE TABLE IF NOT EXISTS creator_payout_preferences (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  cadence text NOT NULL DEFAULT 'manual',
  minimum_amount numeric(18, 8) NOT NULL DEFAULT 0,
  weekday integer,
  month_day integer,
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT false,
  next_run_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creator_fee_policies (
  id serial PRIMARY KEY,
  payment_kind text NOT NULL,
  platform_fee_bps integer NOT NULL DEFAULT 0,
  payout_fee_payer text NOT NULL DEFAULT 'creator',
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  effective_at timestamp with time zone,
  updated_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(payment_kind, version)
);
CREATE INDEX IF NOT EXISTS creator_fee_policies_kind_status_idx
  ON creator_fee_policies (payment_kind, status, effective_at);

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS payout_profile_id integer REFERENCES creator_payout_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_masked text,
  ADD COLUMN IF NOT EXISTS request_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fee_amount numeric(18, 8),
  ADD COLUMN IF NOT EXISTS fee_currency text,
  ADD COLUMN IF NOT EXISTS fee_quoted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS usd_reference_amount numeric(18, 8),
  ADD COLUMN IF NOT EXISTS usd_reference_rate numeric(18, 8),
  ADD COLUMN IF NOT EXISTS provider_transaction_url text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_idempotency_key_unique
  ON payout_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO feature_flags (key, description, enabled, rollout)
VALUES
  ('creator_payout_requests', 'Creator payout-request queue. Keep disabled until encrypted payout profiles, creator ledger monitoring, and owner review procedures are operational.', false, '{}'::jsonb),
  ('scheduled_payout_requests', 'Scheduled daily, weekly, and monthly payout request generation. Keep disabled until a production scheduler, idempotency checks, and alerting are configured.', false, '{}'::jsonb),
  ('provider_withdrawals', 'Provider withdrawal execution. Keep disabled until request IP, provider balances, fee estimation, reconciliation, and incident response are verified.', false, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

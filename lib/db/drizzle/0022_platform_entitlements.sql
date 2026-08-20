-- Platform-level ad-free entitlement registry — production-pending operator approval.
--
-- Validated only on disposable Neon branch br-soft-heart-a6rd4ml4 on 2026-08-20.
-- This table is additive and server-owned. It does not enable advertising delivery,
-- create a browser mutation endpoint, or allow creator subscriptions to imply a
-- platform-wide ad-free plan.
--
-- Do not apply this migration to the production branch until an authorized operator
-- has reviewed the isolated validation and explicitly approved rollout.

CREATE TABLE IF NOT EXISTS platform_entitlements (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entitlement_type text NOT NULL DEFAULT 'ad_free',
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  grant_source text NOT NULL,
  source_reference text,
  granted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_entitlements_type_check
    CHECK (entitlement_type IN ('ad_free')),
  CONSTRAINT platform_entitlements_status_check
    CHECK (status IN ('active', 'revoked', 'expired')),
  CONSTRAINT platform_entitlements_window_check
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Fast server-side resolver path for current account-level ad-free eligibility.
CREATE INDEX IF NOT EXISTS platform_entitlements_active_resolver_idx
  ON platform_entitlements (user_id, entitlement_type, starts_at DESC)
  WHERE status = 'active';

-- Idempotency reference for a provider webhook, operator grant, recovery event, or
-- other reviewed source. A null reference remains valid for manually audited grants.
CREATE UNIQUE INDEX IF NOT EXISTS platform_entitlements_source_reference_unique
  ON platform_entitlements (grant_source, source_reference)
  WHERE source_reference IS NOT NULL;

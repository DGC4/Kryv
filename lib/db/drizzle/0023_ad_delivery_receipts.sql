-- Signed advertising delivery receipts — production-pending operator approval.
--
-- Validated only on disposable Neon branch br-icy-river-a60m2ip8 on 2026-08-20.
-- This schema is additive preparation for a future idempotent measurement path. It
-- does not enable advertising delivery, issue decisions, expose an impression API,
-- or permit client-reported delivery to affect frequency, revenue, or budget state.
--
-- Do not apply this migration to the production branch until an authorized operator
-- has reviewed the isolated validation, signed-decision design, fraud controls,
-- reconciliation plan, and separate advertising launch gates.

CREATE TABLE IF NOT EXISTS ad_delivery_receipts (
  id uuid PRIMARY KEY,
  ad_break_id integer NOT NULL REFERENCES ad_breaks(id) ON DELETE CASCADE,
  creative_id integer REFERENCES ad_creatives(id) ON DELETE SET NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id integer REFERENCES viewer_profiles(id) ON DELETE SET NULL,
  surface text NOT NULL,
  decision_hash text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'issued',
  qualified_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_delivery_receipts_surface_check
    CHECK (surface IN ('live', 'watch', 'cinema', 'clip')),
  CONSTRAINT ad_delivery_receipts_status_check
    CHECK (delivery_status IN ('issued', 'requested', 'qualified', 'completed', 'rejected', 'expired')),
  CONSTRAINT ad_delivery_receipts_expiry_check
    CHECK (expires_at > issued_at),
  CONSTRAINT ad_delivery_receipts_qualified_at_check
    CHECK (qualified_at IS NULL OR qualified_at >= issued_at),
  CONSTRAINT ad_delivery_receipts_completed_at_check
    CHECK (completed_at IS NULL OR completed_at >= issued_at)
);

-- Receipt lookup must be fast and bounded by the signed-decision expiry window.
CREATE INDEX IF NOT EXISTS ad_delivery_receipts_verification_idx
  ON ad_delivery_receipts (decision_hash, expires_at);

-- Supports accountable operator reconciliation and incident investigation by viewer.
CREATE INDEX IF NOT EXISTS ad_delivery_receipts_user_created_idx
  ON ad_delivery_receipts (user_id, created_at DESC);

-- Kryv platform scale foundations: immutable fee allocation, transactional hot-path indexes,
-- and crypto-only provider defaults. This migration is additive and safe to apply repeatedly.

CREATE TABLE IF NOT EXISTS platform_revenue_movements (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  currency text NOT NULL,
  payment_kind text NOT NULL,
  gross_amount numeric(18, 8) NOT NULL,
  platform_fee_amount numeric(18, 8) NOT NULL,
  creator_net_amount numeric(18, 8) NOT NULL,
  fee_policy_id integer REFERENCES creator_fee_policies(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_revenue_movements_amounts_check CHECK (
    gross_amount >= 0
    AND platform_fee_amount >= 0
    AND creator_net_amount >= 0
    AND gross_amount = platform_fee_amount + creator_net_amount
  )
);
CREATE INDEX IF NOT EXISTS platform_revenue_movements_channel_created_idx
  ON platform_revenue_movements(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_revenue_movements_kind_created_idx
  ON platform_revenue_movements(payment_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_revenue_movements_source_idx
  ON platform_revenue_movements(source_type, source_id);

-- Every creator-ledger row is immutable; the explicit fee debit keeps the creator
-- balance reconciled to the separate platform-revenue movement.
CREATE INDEX IF NOT EXISTS creator_balance_movements_channel_type_created_idx
  ON creator_balance_movements(channel_id, movement_type, created_at DESC);

-- Fast pagination for non-deleted message reads and per-user slow-mode fallback.
CREATE INDEX IF NOT EXISTS chat_messages_channel_visible_created_idx
  ON chat_messages(channel_id, created_at ASC, id ASC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS chat_messages_channel_user_visible_created_idx
  ON chat_messages(channel_id, user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Live session lookup supports lifecycle aggregation and direct creator-session views.
CREATE INDEX IF NOT EXISTS stream_sessions_channel_active_started_idx
  ON stream_sessions(channel_id, started_at DESC)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS stream_sessions_category_active_started_idx
  ON stream_sessions(category_id, started_at DESC)
  WHERE ended_at IS NULL;

-- Queue/worker scans and invoice callback reconciliation remain bounded.
CREATE INDEX IF NOT EXISTS payment_events_provider_status_created_idx
  ON payment_events(provider, processing_status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_completed_at_idx
  ON payment_intents(completed_at DESC)
  WHERE status = 'completed';

-- Correct legacy provider defaults for new rows. Applied migration history is retained
-- unchanged for auditability; the running schema is explicitly crypto-only.
ALTER TABLE IF EXISTS subscriptions ALTER COLUMN provider SET DEFAULT 'plisio';
ALTER TABLE IF EXISTS tips ALTER COLUMN provider SET DEFAULT 'plisio';
ALTER TABLE IF EXISTS payment_events ALTER COLUMN provider SET DEFAULT 'plisio';
ALTER TABLE IF EXISTS payment_intents ALTER COLUMN provider SET DEFAULT 'plisio';
ALTER TABLE IF EXISTS creator_payment_accounts ALTER COLUMN provider SET DEFAULT 'plisio';

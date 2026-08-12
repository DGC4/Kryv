-- Production customer-wallet ledger. Customer balances are credited exclusively by
-- signed provider pay-in callbacks and remain separate from creator earnings.

CREATE TABLE IF NOT EXISTS customer_wallet_balances (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  pending_amount numeric(18, 8) NOT NULL DEFAULT 0,
  available_amount numeric(18, 8) NOT NULL DEFAULT 0,
  held_amount numeric(18, 8) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_wallet_balances_amounts_nonnegative CHECK (
    pending_amount >= 0 AND available_amount >= 0 AND held_amount >= 0
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_wallet_balances_user_currency_unique
  ON customer_wallet_balances(user_id, currency);

CREATE TABLE IF NOT EXISTS customer_wallet_movements (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  movement_type text NOT NULL,
  available_delta numeric(18, 8) NOT NULL DEFAULT 0,
  held_delta numeric(18, 8) NOT NULL DEFAULT 0,
  pending_delta numeric(18, 8) NOT NULL DEFAULT 0,
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_wallet_movements_user_created_idx
  ON customer_wallet_movements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_wallet_movements_source_idx
  ON customer_wallet_movements(source_type, source_id);

CREATE TABLE IF NOT EXISTS customer_wallet_deposit_addresses (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  provider text NOT NULL DEFAULT 'plisio',
  provider_deposit_uid text NOT NULL,
  deposit_address text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_wallet_deposit_addresses_status_check CHECK (status IN ('active', 'disabled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_wallet_deposit_addresses_user_currency_provider_unique
  ON customer_wallet_deposit_addresses(user_id, currency, provider);
CREATE UNIQUE INDEX IF NOT EXISTS customer_wallet_deposit_addresses_provider_address_unique
  ON customer_wallet_deposit_addresses(provider, deposit_address);
CREATE INDEX IF NOT EXISTS customer_wallet_deposit_addresses_provider_uid_currency_idx
  ON customer_wallet_deposit_addresses(provider, provider_deposit_uid, currency);

-- Wallet custody is disabled by default. A production owner must verify the provider
-- callback, reconciliation, and incident controls before exposing deposit addresses.
INSERT INTO feature_flags (key, description, enabled, rollout)
VALUES (
  'customer_wallet_custody',
  'Customer deposit addresses and internal wallet balances. Keep disabled until signed pay-in callbacks, reconciliation, and support controls are verified.',
  false,
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

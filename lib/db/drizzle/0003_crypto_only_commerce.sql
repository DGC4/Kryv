-- Kryv is crypto-only for all active settlement paths. Historical provider rows are
-- intentionally retained for audit, but no new active application flow can create them.
ALTER TABLE subscriptions
  ALTER COLUMN provider SET DEFAULT 'plisio';

ALTER TABLE payment_events
  ALTER COLUMN provider SET DEFAULT 'plisio';

ALTER TABLE tips
  ALTER COLUMN provider SET DEFAULT 'plisio',
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN amount TYPE numeric(18, 8) USING amount::numeric,
  ALTER COLUMN platform_fee_amount TYPE numeric(18, 8) USING platform_fee_amount::numeric;

-- This legacy table is no longer used by application code. Remove its card-provider
-- default without deleting historical records that may be needed for audit retention.
ALTER TABLE creator_payment_accounts
  ALTER COLUMN provider DROP DEFAULT;

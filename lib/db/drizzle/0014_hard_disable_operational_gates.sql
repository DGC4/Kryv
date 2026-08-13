-- Operational launch-gate correction: these capabilities remain unavailable until
-- their separate production authorization projects are complete. This migration
-- heals any prior accidental owner-console activation without creating custody,
-- scheduling, or provider-withdrawal side effects.
UPDATE feature_flags
SET enabled = false,
    updated_at = now()
WHERE key IN (
  'ads_delivery',
  'customer_wallet_custody',
  'scheduled_payout_requests',
  'provider_withdrawals'
);

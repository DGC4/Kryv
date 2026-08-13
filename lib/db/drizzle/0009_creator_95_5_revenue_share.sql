-- Kryv creator economics: 95% creator share / 5% platform share.
-- Provider checkout commission is client-borne and remains separate from this split.
-- Existing immutable settlements retain their original policy metadata.

INSERT INTO creator_fee_policies (
  payment_kind,
  platform_fee_bps,
  payout_fee_payer,
  status,
  version,
  effective_at
)
VALUES
  ('subscription', 500, 'creator', 'active', 1, now()),
  ('tip', 500, 'creator', 'active', 1, now())
ON CONFLICT (payment_kind, version) DO NOTHING;

-- Owner-controlled, crypto-only advertiser program.
-- Free launch flights are explicitly capped promotions; paid delivery remains blocked until a
-- signed provider callback confirms campaign funding.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS advertiser_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funding_mode text NOT NULL DEFAULT 'promotional',
  ADD COLUMN IF NOT EXISTS funding_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS budget_amount numeric(18, 8),
  ADD COLUMN IF NOT EXISTS budget_currency text,
  ADD COLUMN IF NOT EXISTS budget_spent_amount numeric(18, 8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_share_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS ad_campaigns_funding_status_idx
  ON ad_campaigns (status, funding_status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_campaign_fundings (
  id serial PRIMARY KEY,
  campaign_id integer NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  advertiser_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  funding_type text NOT NULL DEFAULT 'paid',
  provider text NOT NULL DEFAULT 'plisio',
  provider_payment_id text UNIQUE,
  order_number text NOT NULL UNIQUE,
  source_amount numeric(18, 8) NOT NULL,
  source_currency text NOT NULL DEFAULT 'USD',
  selected_currency text,
  invoice_amount numeric(18, 8),
  invoice_commission numeric(18, 8),
  invoice_total numeric(18, 8),
  received_amount numeric(18, 8),
  status text NOT NULL DEFAULT 'creating',
  expires_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_campaign_fundings_campaign_status_idx
  ON ad_campaign_fundings (campaign_id, status, created_at);

CREATE TABLE IF NOT EXISTS ad_revenue_movements (
  id serial PRIMARY KEY,
  campaign_id integer NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  funding_id integer REFERENCES ad_campaign_fundings(id) ON DELETE SET NULL,
  channel_id integer REFERENCES channels(id) ON DELETE SET NULL,
  currency text NOT NULL,
  movement_type text NOT NULL,
  gross_amount numeric(18, 8) NOT NULL,
  platform_amount numeric(18, 8) NOT NULL,
  creator_amount numeric(18, 8) NOT NULL DEFAULT 0,
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (gross_amount >= 0 AND platform_amount >= 0 AND creator_amount >= 0),
  CHECK (gross_amount = platform_amount + creator_amount)
);
CREATE INDEX IF NOT EXISTS ad_revenue_movements_campaign_created_idx
  ON ad_revenue_movements (campaign_id, created_at);

-- Prevent accidental paid delivery when no confirmed campaign funding exists.
-- Application code additionally enforces this condition before it returns a decision.

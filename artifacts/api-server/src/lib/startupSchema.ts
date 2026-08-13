import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Ensures storage for the non-secret Finance Command operating context exists before
 * the HTTP server accepts requests. This intentionally covers only additive,
 * backwards-compatible compatibility relations required by currently deployed public
 * routes and normalizes legacy schedule metadata to the current manual-only payout
 * boundary. It is not a replacement for the platform's broader migration process and
 * does not create money movement, custody, payout execution, provider credentials, or
 * ad delivery.
 */
export async function ensureAdminTreasuryContextSchema(): Promise<void> {
  // Public creator profiles and Watch read these columns on every request. They were
  // introduced after the earliest production databases existed, so ensure legacy
  // instances can safely boot current code before their normal migration sweep.
  await db.execute(sql`
    ALTER TABLE IF EXISTS videos
      ADD COLUMN IF NOT EXISTS playback_source text NOT NULL DEFAULT 'fastpix';
  `);
  await db.execute(sql`
    ALTER TABLE IF EXISTS videos
      ADD COLUMN IF NOT EXISTS youtube_video_id text;
  `);
  await db.execute(sql`
    ALTER TABLE IF EXISTS videos
      ADD COLUMN IF NOT EXISTS rights_attested_at timestamptz;
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS videos_playback_source_idx
      ON videos (playback_source, created_at DESC);
  `);

  // Cinema credits are owner-curated metadata only. This empty relation grants no
  // creator publishing right and lets public profiles safely expose only credits that
  // the owner has actually recorded.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cinema_credits (
      id serial PRIMARY KEY,
      cinema_title_id integer NOT NULL REFERENCES cinema_titles(id) ON DELETE CASCADE,
      channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      role text NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS cinema_credits_title_channel_role_unique
      ON cinema_credits (cinema_title_id, channel_id, role);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cinema_credits_channel_order_idx
      ON cinema_credits (channel_id, display_order, created_at);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cinema_credits_title_order_idx
      ON cinema_credits (cinema_title_id, display_order, created_at);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_treasury_context (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      label text,
      notes text,
      updated_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT admin_treasury_context_label_length CHECK (label IS NULL OR char_length(label) <= 120),
      CONSTRAINT admin_treasury_context_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000)
    );
  `);

  // Scheduled payout requests are hard-disabled. Clear any legacy schedule metadata
  // so a future worker or client cannot mistake it for an approved payout instruction.
  await db.execute(sql`
    UPDATE creator_payout_preferences
    SET cadence = 'manual',
        enabled = false,
        weekday = NULL,
        month_day = NULL,
        next_run_at = NULL,
        updated_at = now()
    WHERE cadence <> 'manual'
       OR enabled = true
       OR weekday IS NOT NULL
       OR month_day IS NOT NULL
       OR next_run_at IS NOT NULL;
  `);

  // These capability rows may exist in older environments, but each corresponding
  // operation is hard-disabled in code. Persist the disabled state too, preventing
  // owner surfaces or future workers from treating a legacy row as launch approval.
  await db.execute(sql`
    UPDATE feature_flags
    SET enabled = false,
        updated_at = now()
    WHERE key IN ('customer_wallet_custody', 'ads_delivery', 'scheduled_payout_requests', 'provider_withdrawals')
      AND enabled = true;
  `);
}

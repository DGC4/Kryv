import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Ensures storage for the non-secret Finance Command operating context exists before
 * the HTTP server accepts requests. This is intentionally limited to the one
 * additive table introduced with the feature and normalizes legacy schedule metadata
 * to the current manual-only payout boundary. It is not a replacement for the
 * platform's broader migration process and does not create money movement, custody,
 * payout execution, provider credentials, or ad delivery.
 */
export async function ensureAdminTreasuryContextSchema(): Promise<void> {
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
}

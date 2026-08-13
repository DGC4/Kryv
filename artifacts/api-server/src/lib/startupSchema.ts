import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Ensures storage for the non-secret Finance Command operating context exists before
 * the HTTP server accepts requests. This is intentionally limited to the one
 * additive table introduced with the feature; it is not a replacement for the
 * platform's broader migration process and does not touch money movement, custody,
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
}

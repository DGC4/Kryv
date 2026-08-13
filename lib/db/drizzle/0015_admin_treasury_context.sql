-- Owner-editable treasury operating context. This singleton stores only non-secret
-- labels and notes for the finance command center; it must never contain provider
-- credentials, wallet addresses, custody balances, or payout instructions.
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

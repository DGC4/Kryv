-- Identity and session hardening.
--
-- This migration removes username-derived authority as a source of truth. Existing
-- legacy owner rows are backfilled once into explicit, reviewable platform_roles
-- grants. Browser sessions store only a random opaque cookie value; this table
-- stores its SHA-256 hash so individual and account-wide revocation is immediate.

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS platform_roles (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  granted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_roles_role_check CHECK (role IN ('owner', 'admin', 'support'))
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_roles_user_role_unique
  ON platform_roles (user_id, role);
CREATE INDEX IF NOT EXISTS platform_roles_active_role_idx
  ON platform_roles (role, revoked_at, expires_at);

-- Preserve existing owners, but never derive authority from their username again.
INSERT INTO platform_roles (user_id, role, granted_by_user_id)
SELECT id, 'owner', id
FROM users
WHERE role = 'owner'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_sessions (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  session_version integer NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash_unique
  ON user_sessions (token_hash);
CREATE INDEX IF NOT EXISTS user_sessions_user_active_idx
  ON user_sessions (user_id, revoked_at, expires_at);

-- Kryv viewer-profile default integrity.
--
-- Enforces at most one default profile per account while allowing profiles without
-- a default flag. Validate on an isolated Neon branch before any production rollout.
--
-- This is an operational PostgreSQL statement and MUST run outside a transaction:
-- CONCURRENTLY avoids a blocking table-wide index build during an explicitly approved
-- production promotion. Verify the catalog entry after the independently executed build.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS viewer_profiles_default_user_unique
  ON viewer_profiles (user_id)
  WHERE is_default = true;

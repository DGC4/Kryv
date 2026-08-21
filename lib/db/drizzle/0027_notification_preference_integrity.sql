-- Kryv global notification-preference integrity.
--
-- Enforces at most one account-wide notification-preference row per user while
-- allowing future channel-scoped preference rows. Validate on an isolated Neon
-- branch before any production rollout.
--
-- This is an operational PostgreSQL statement and MUST run outside a transaction:
-- CONCURRENTLY avoids a blocking table-wide index build during an explicitly approved
-- production promotion. Verify the catalog entry after the independently executed build.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS notification_preferences_global_user_unique
  ON notification_preferences (user_id)
  WHERE channel_id IS NULL;

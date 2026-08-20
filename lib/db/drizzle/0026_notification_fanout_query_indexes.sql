-- Kryv notification fan-out recipient-query index.
--
-- Supports bounded keyset traversal of followers for a channel during live, Watch,
-- and Clip inbox notification fan-out. Validate on an isolated Neon branch before
-- any production rollout.
--
-- This is an operational PostgreSQL statement and MUST run outside a transaction:
-- CONCURRENTLY avoids a blocking table-wide index build during an explicitly approved
-- production promotion. Verify the catalog entry after the independently executed build.

CREATE INDEX CONCURRENTLY IF NOT EXISTS follows_channel_id_idx
  ON follows (channel_id, id);

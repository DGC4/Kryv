-- Kryv notification inbox query indexes.
--
-- Supports authenticated newest-first inbox retrieval and unread-count aggregation at
-- scale. Validate on an isolated Neon branch before any production rollout.
--
-- These are operational PostgreSQL statements and MUST run outside a transaction:
-- CONCURRENTLY avoids a blocking table-wide index build during an explicitly approved
-- production promotion. Run each statement independently and verify both indexes exist.

CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_unread_user_idx
  ON notifications (user_id)
  WHERE is_read = false;

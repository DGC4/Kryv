-- Watch video maturity classification — production-pending operator approval.
--
-- Validated only on disposable Neon branch br-snowy-mud-a6nr8rrz on 2026-08-20.
-- Do not apply this migration to the production branch until an authorized operator
-- has reviewed the isolated-branch validation record and approved rollout.
--
-- Existing Watch uploads default to "standard", which is the least-privilege
-- classification compatible with existing adult/general-audience inventory. The
-- check constraint bounds every future value to the same maturity taxonomy used by
-- session-bound Kryv viewer profiles and Cinema titles.

ALTER TABLE IF EXISTS videos
  ADD COLUMN IF NOT EXISTS maturity_level text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'videos_maturity_level_check'
      AND conrelid = 'public.videos'::regclass
  ) THEN
    ALTER TABLE videos
      ADD CONSTRAINT videos_maturity_level_check
      CHECK (maturity_level IN ('kids', 'standard', 'mature'));
  END IF;
END
$$;

-- Supports profile-filtered public Watch discovery without indexing unfinished or
-- owner-private uploads. For production rollout, assess CONCURRENTLY creation if
-- table volume has increased materially since isolated validation.
CREATE INDEX IF NOT EXISTS videos_ready_upload_maturity_created_idx
  ON videos (maturity_level, created_at DESC)
  WHERE content_type = 'upload' AND upload_status = 'ready';

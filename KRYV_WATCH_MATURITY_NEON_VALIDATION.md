# Kryv Watch Maturity Schema Validation

## Status

**Production change status: pending explicit operator approval.** This record documents an isolated Neon branch validation only. No SQL from this change has been applied to the production branch.

## Objective

Kryv Cinema and Live use the `kids`, `standard`, and `mature` taxonomy for server-authoritative active-profile eligibility. The Watch `videos` table did not contain an equivalent classification, which prevented Watch from enforcing the same policy without guessing from titles, descriptions, or categories.

## Production Baseline Observed

The Neon production project is `kryv` (`bold-cake-75596541`) on PostgreSQL 18. The `videos` table had no `maturity_level` column. It contains standard Watch metadata, provider references, publication state, and the ready-upload access path, but no field capable of expressing a viewer-profile maturity decision.

| Item                        | Production finding before validation |
| --------------------------- | ------------------------------------ |
| Table                       | `public.videos`                      |
| Maturity column             | Absent                               |
| Existing profile taxonomy   | `kids`, `standard`, `mature`         |
| Existing ready-upload index | No maturity-aware index              |
| Production mutation         | None                                 |

## Isolated Validation Environment

| Property                     | Value                        |
| ---------------------------- | ---------------------------- |
| Project                      | `bold-cake-75596541`         |
| Parent branch                | `br-bold-waterfall-a6zmt608` |
| Temporary branch             | `br-snowy-mud-a6nr8rrz`      |
| Branch name                  | `watch-maturity-validation`  |
| Expiry                       | 2026-08-27T12:00:00Z         |
| PostgreSQL version           | 18                           |
| Production database modified | No                           |

## Validated Schema Delta

The temporary branch accepted the following schema design.

```sql
ALTER TABLE videos
  ADD COLUMN maturity_level text NOT NULL DEFAULT 'standard';

ALTER TABLE videos
  ADD CONSTRAINT videos_maturity_level_check
  CHECK (maturity_level IN ('kids', 'standard', 'mature'));

CREATE INDEX videos_ready_upload_maturity_created_idx
  ON videos (maturity_level, created_at DESC)
  WHERE content_type = 'upload' AND upload_status = 'ready';
```

The validated branch schema confirmed all three elements: a non-null `maturity_level` column with static `standard` default, the bounded check constraint, and the partial ready-upload maturity index. The branch’s copied table contained no video rows, so the structural default was confirmed but no inventory backfill volume measurement was possible.

| Validation                 | Result                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Column creation            | Passed; `maturity_level text NOT NULL DEFAULT 'standard'` present |
| Allowed-value constraint   | Passed; check limited values to `kids`, `standard`, `mature`      |
| Ready-upload access path   | Passed; partial index present                                     |
| Existing branch video rows | None; no row-volume backfill measurement available                |
| Production branch mutation | Not performed                                                     |

## Rollout Conditions

The prepared migration is `lib/db/drizzle/0021_watch_video_maturity.sql`. It is explicitly marked **production-pending** and must not be applied autonomously. Before production rollout, an authorized operator should review the migration, confirm current `videos` table volume and write traffic, create or confirm a recovery point, and approve the production change.

For a materially larger production table, the index should be assessed for `CREATE INDEX CONCURRENTLY` in the production execution plan. Application-level Watch maturity gating must remain disabled until the production column is present, the Drizzle schema and API contract are updated, and end-to-end server/client regression coverage passes.

## Rollback Considerations

No rollback is needed for the current work because production was untouched. If a future approved rollout requires reversal, first disable any Watch maturity enforcement in application deployment, then remove the index and constraint before removing the column. Such destructive production operations require separate explicit operator approval and a current backup or point-in-time recovery plan.

## Evidence

The Neon schema comparison from the temporary branch identified exactly one table delta and one index delta: `videos.maturity_level`, `videos_maturity_level_check`, and `videos_ready_upload_maturity_created_idx`. This record and the migration file are intended to make the eventual approval decision independently reviewable.

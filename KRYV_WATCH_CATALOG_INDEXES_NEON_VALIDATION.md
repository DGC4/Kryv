# Kryv Watch Catalog Indexes — Neon Isolated-Branch Validation

**Status:** Production-pending. **No production schema change was performed.**

This record validates the additive index migration in `lib/db/drizzle/0024_watch_catalog_query_indexes.sql` against a disposable Neon branch. The migration aligns with the bounded Watch browse page and creator-profile rail introduced in Kryv’s application layer. It is intentionally independent of the pending Watch maturity migration (`0021_watch_video_maturity.sql`) and does not add, modify, or remove user data.

| Validation item                      | Result                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Neon project                         | `bold-cake-75596541`                                                          |
| Isolated branch                      | `br-spring-violet-a6nnddvp` (`validate-watch-catalog-indexes-20260820`)       |
| Parent branch                        | `br-bold-waterfall-a6zmt608`                                                  |
| Branch expiry                        | 2026-08-27T13:55:00Z                                                          |
| Validation date                      | 2026-08-20 EDT                                                                |
| Production mutation                  | None                                                                          |
| Migration outcome on isolated branch | Both additive `CREATE INDEX IF NOT EXISTS` statements completed successfully. |

## Validated Index Definitions

The isolated branch confirmed the following exact definitions after applying the migration.

| Index                              | Definition                                                                                 | Query path covered                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `videos_ready_upload_created_idx`  | `(created_at DESC, id DESC)` where `content_type = 'upload'` and `upload_status = 'ready'` | Public ready-Watch browse pages ordered newest-first.                                                |
| `videos_watch_channel_created_idx` | `(channel_id, created_at DESC, id DESC)` where `content_type = 'upload'`                   | Creator-scoped Watch libraries, including non-ready owner inventory and ready creator-profile rails. |

> The production index inventory conducted before validation showed neither Watch index. Production currently contains only the Cinema catalog, FastPix asset uniqueness, primary-key, and playback-source indexes for `videos`.

## Planner and Data-Volume Evidence

The isolated branch had zero `videos` rows, zero ready Watch uploads, and zero channels with videos. Its public Watch `EXPLAIN` therefore selected a sequential scan with an estimated one row and a total cost of `1.01`; this is the expected low-cardinality plan and is **not** evidence that the index predicate or ordering is incompatible. The validated index definitions exactly cover the new query predicates and ordering.

| Query shape                                                                                         | Validation interpretation                                                                                               |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Public Watch page: ready uploads ordered by `created_at DESC, id DESC`, limit 48                    | Covered by `videos_ready_upload_created_idx`.                                                                           |
| Creator profile rail: ready uploads for one channel ordered by `created_at DESC, id DESC`, limit 48 | Covered by `videos_watch_channel_created_idx`; the ready predicate is evaluated on the small channel-scoped result set. |
| Creator studio inventory: uploads for one channel ordered by `created_at DESC, id DESC`             | Covered by `videos_watch_channel_created_idx`.                                                                          |

## Required Production Rollout Gate

This migration must **not** be applied to production automatically. Before any production rollout, an authorized operator should review the bounded Watch page release, confirm the production branch and maintenance window, assess whether non-concurrent index creation is acceptable for the production table’s actual size and write volume, and then approve a controlled migration. After rollout, verify `pg_indexes`, run representative `EXPLAIN` statements on production-volume inventory, and observe API latency and database load.

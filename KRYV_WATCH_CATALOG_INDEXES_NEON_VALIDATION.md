# Kryv Watch Catalog Indexes — Neon Validation Record

**Status:** Production-pending. **No production schema change was performed.**

This record validates the additive Watch catalog index script in `lib/db/drizzle/0024_watch_catalog_query_indexes.sql` on a fresh isolated Neon branch. The indexes support the bounded Watch browse page and creator-scoped rails without indexing Cinema originals. The revised operational statements use `CREATE INDEX CONCURRENTLY IF NOT EXISTS`; PostgreSQL requires each to run outside a transaction so that a future, explicitly approved production rollout avoids a blocking table-wide index build.

| Validation item | Result |
| --- | --- |
| Neon project | `bold-cake-75596541` |
| Production parent | `br-bold-waterfall-a6zmt608` |
| Fresh isolated branch | `br-blue-union-a6uq3yjr` (`validate-watch-indexes-concurrent-20260820`) |
| Validation date | 2026-08-20 EDT |
| Production mutation | None |
| Branch mutation | Both concurrent index statements completed independently on the isolated branch. |
| Catalog verification | PostgreSQL `pg_indexes` confirmed both intended index definitions and partial predicates. |

## Validated Index Definitions

| Index | Verified definition | Query path covered |
| --- | --- | --- |
| `videos_ready_upload_created_idx` | `(created_at DESC, id DESC)` where `content_type = 'upload'` and `upload_status = 'ready'` | Public ready-Watch browse pages ordered newest-first. |
| `videos_watch_channel_created_idx` | `(channel_id, created_at DESC, id DESC)` where `content_type = 'upload'` | Creator-scoped Watch libraries, including non-ready owner inventory and ready creator-profile rails. |

> The isolated-branch catalog query returned both indexes with the expected partial predicates. Neon’s catalog display omits `CONCURRENTLY` because it describes the completed index object rather than the creation command; the branch execution itself used `CREATE INDEX CONCURRENTLY IF NOT EXISTS` in two separate statements.

## Validation Scope and Interpretation

The production schema comparison before this validation showed that production does not yet contain either index. The prior non-concurrent validation branch demonstrated logical compatibility, while this fresh branch additionally demonstrated that the reviewed production-safe operational form succeeds when each command is issued independently. No user data was inserted, altered, or deleted during the isolated validation.

The validation branch is structurally representative but has low Watch inventory volume. It therefore confirms schema correctness and command compatibility, not production-scale planner selection. After any approved production rollout, validate the exact index definitions with `pg_indexes`, run representative `EXPLAIN` statements against production-volume inventory, and observe API latency, query timing, and write pressure.

## Required Production Rollout Gate

The migration must **not** be promoted or manually applied to production without explicit operator approval. Before a promotion, the operator should confirm the intended production branch, maintenance and monitoring coverage, and the current table write volume. The two commands must be executed **independently outside a transaction**, with no unrelated DDL batched alongside them. Afterward, re-run catalog verification and representative query plans; retain the resulting evidence with the release record.

The current validation branch is isolated and production remains unchanged.

# Kryv Notification Fan-Out Index — Neon Validation Record

## Purpose

This record documents isolated-branch validation for [`lib/db/drizzle/0026_notification_fanout_query_indexes.sql`](lib/db/drizzle/0026_notification_fanout_query_indexes.sql). The index supports keyset-paged recipient traversal for followed-channel live, Watch, and Clip inbox notifications.

> **Status: VALIDATED ON AN ISOLATED NEON BRANCH ONLY. NO PRODUCTION PROMOTION HAS OCCURRED.**

## Validation Environment

| Field                           | Value                                         |
| ------------------------------- | --------------------------------------------- |
| Neon project                    | `bold-cake-75596541`                          |
| Parent branch                   | `br-bold-waterfall-a6zmt608`                  |
| Isolated validation branch      | `br-lingering-rice-a6fszepe`                  |
| Isolated validation branch name | `validate-notification-fanout-index-20260820` |
| Validation date                 | 2026-08-20                                    |
| Target table                    | `public.follows`                              |

## Validated DDL

The following statement was executed on the isolated branch:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS follows_channel_id_idx
  ON follows (channel_id, id);
```

`CREATE INDEX CONCURRENTLY` **must run outside a transaction**. The operational migration runner must execute this statement independently; it must not wrap the migration in a transactional block.

## Catalog Verification

The following query was run against `br-lingering-rice-a6fszepe`:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'follows'
  AND indexname = 'follows_channel_id_idx';
```

| Index                    | Catalog definition verified                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `follows_channel_id_idx` | `CREATE INDEX ... ON public.follows USING btree (channel_id, id)` |

## Promotion Boundary

This validation branch is not a production deployment. **No production promotion has occurred, and no production promotion is authorized by this record.** A separate explicit production approval is required before any production rollout.

Before an approved rollout, the operator must confirm that the target production schema still matches the validation baseline, run the concurrent statement outside a transaction, verify the `pg_indexes` entry on the production branch, and monitor index-build completion, webhook latency, queue depth, and application error rates. If production state has drifted, create and validate a fresh isolated branch before proceeding.

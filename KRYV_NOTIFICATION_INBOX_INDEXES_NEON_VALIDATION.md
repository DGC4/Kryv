# Kryv Notification Inbox Indexes — Neon Validation Record

## Purpose

This record documents isolated-branch validation for the notification inbox indexes defined in [`lib/db/drizzle/0025_notification_inbox_query_indexes.sql`](lib/db/drizzle/0025_notification_inbox_query_indexes.sql). The indexes support the authenticated notification inbox’s newest-first retrieval and unread-count aggregation without changing application behavior or relaxing authorization boundaries.

> **Status: VALIDATED ON AN ISOLATED NEON BRANCH ONLY. NO PRODUCTION PROMOTION HAS OCCURRED.**

## Validation Environment

| Field                           | Value                                          |
| ------------------------------- | ---------------------------------------------- |
| Neon project                    | `bold-cake-75596541`                           |
| Parent branch                   | `br-bold-waterfall-a6zmt608`                   |
| Isolated validation branch      | `br-lucky-wind-a6ik3vpo`                       |
| Isolated validation branch name | `validate-notification-inbox-indexes-20260820` |
| Validation date                 | 2026-08-20                                     |
| Target table                    | `public.notifications`                         |

## Validated DDL

The following statements were executed **individually** on the isolated branch:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_unread_user_idx
  ON notifications (user_id)
  WHERE is_read = false;
```

Each statement uses `CREATE INDEX CONCURRENTLY` and therefore **must run outside a transaction**. The operational migration runner must execute each statement independently; it must not wrap the file in a transactional migration block.

## Catalog Verification

The following query was run against `br-lucky-wind-a6ik3vpo`:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notifications'
  AND indexname IN (
    'notifications_user_created_idx',
    'notifications_unread_user_idx'
  )
ORDER BY indexname;
```

| Index                            | Catalog definition verified                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `notifications_user_created_idx` | `CREATE INDEX ... ON public.notifications USING btree (user_id, created_at DESC, id DESC)` |
| `notifications_unread_user_idx`  | `CREATE INDEX ... ON public.notifications USING btree (user_id) WHERE (is_read = false)`   |

## Promotion Boundary

This validation branch is not a production deployment. **No production promotion has occurred, and no production promotion is authorized by this record.** A separate explicit production approval is required before any production rollout.

Before an approved rollout, the operator must confirm that the target production schema still matches the validation baseline, run each concurrent statement outside a transaction, verify both `pg_indexes` entries on the production branch, and monitor index-build completion and application error rates. If production state has drifted, create and validate a fresh isolated branch before proceeding.

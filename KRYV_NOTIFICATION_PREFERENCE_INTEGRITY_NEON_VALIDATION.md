# Kryv Notification Preference Integrity — Neon Validation Record

## Purpose

This record documents isolated-branch validation for [`lib/db/drizzle/0027_notification_preference_integrity.sql`](lib/db/drizzle/0027_notification_preference_integrity.sql). The partial unique index enforces one account-wide notification-preference row per user while preserving the ability to add channel-scoped rows later.

> **Status: VALIDATED ON AN ISOLATED NEON BRANCH ONLY. NO PRODUCTION PROMOTION HAS OCCURRED.**

## Validation Environment

| Field                      | Value                                         |
| -------------------------- | --------------------------------------------- |
| Neon project               | `bold-cake-75596541`                          |
| Parent branch              | `br-bold-waterfall-a6zmt608`                  |
| Isolated validation branch | `br-lingering-rice-a6fszepe`                  |
| Branch name                | `validate-notification-fanout-index-20260820` |
| Validation date            | 2026-08-20                                    |
| Target table               | `public.notification_preferences`             |

A fresh branch request for this narrowly scoped index was rejected because the account reached its Neon branch quota. The already isolated branch above was reused because it was created from the production parent for same-day non-production validation and had previously completed a clean global-preference duplicate audit. No branch was deleted to make capacity; branch deletion requires separate approval.

## Duplicate Preflight

Before index creation, the following query was run against `br-lingering-rice-a6fszepe`:

```sql
SELECT user_id, COUNT(*)::int AS row_count
FROM notification_preferences
WHERE channel_id IS NULL
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY user_id
LIMIT 20;
```

The query returned **zero rows**. This confirms that the validation branch had no detected duplicate account-wide preference rows that would block the partial unique build.

## Validated DDL

The following statement was executed on the isolated branch:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS notification_preferences_global_user_unique
  ON notification_preferences (user_id)
  WHERE channel_id IS NULL;
```

`CREATE UNIQUE INDEX CONCURRENTLY` **must run outside a transaction**. The operational migration runner must execute this statement independently; it must not wrap the migration in a transactional block.

## Catalog Verification

The following query was run against `br-lingering-rice-a6fszepe`:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notification_preferences'
  AND indexname = 'notification_preferences_global_user_unique';
```

| Index                                         | Catalog definition verified                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `notification_preferences_global_user_unique` | `CREATE UNIQUE INDEX ... ON public.notification_preferences USING btree (user_id) WHERE (channel_id IS NULL)` |

## Promotion Boundary

This validation branch is not a production deployment. **No production promotion has occurred, and no production promotion is authorized by this record.** A separate explicit production approval is required before any production rollout.

Before an approved rollout, the operator must repeat the duplicate preflight on the production baseline, confirm the target schema still matches this validation record, execute the concurrent statement outside a transaction, verify the `pg_indexes` entry on the production branch, and monitor index-build completion and notification-preference update error rates. If production state has drifted, create and validate a fresh isolated branch before proceeding.

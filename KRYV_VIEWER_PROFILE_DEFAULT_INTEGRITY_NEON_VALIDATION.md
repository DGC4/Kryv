# Kryv Viewer-Profile Default Integrity — Neon Validation Record

## Purpose

This record documents isolated-branch validation for [`lib/db/drizzle/0028_viewer_profile_default_integrity.sql`](lib/db/drizzle/0028_viewer_profile_default_integrity.sql). The partial unique index enforces at most one default viewer profile per account.

> **Status: VALIDATED ON AN ISOLATED NEON BRANCH ONLY. NO PRODUCTION PROMOTION HAS OCCURRED.**

## Validation Environment

| Field                      | Value                                         |
| -------------------------- | --------------------------------------------- |
| Neon project               | `bold-cake-75596541`                          |
| Parent branch              | `br-bold-waterfall-a6zmt608`                  |
| Isolated validation branch | `br-lingering-rice-a6fszepe`                  |
| Branch name                | `validate-notification-fanout-index-20260820` |
| Validation date            | 2026-08-21                                    |
| Target table               | `public.viewer_profiles`                      |

A fresh branch request for later validation work was rejected because the account had reached its Neon branch quota. This record reuses the already isolated branch above, which was created from the production parent for non-production validation. No branch was deleted to create capacity; branch deletion requires separate approval.

## Duplicate Preflight

Before index creation, the following query was run against `br-lingering-rice-a6fszepe`:

```sql
SELECT user_id, COUNT(*)::int AS row_count
FROM viewer_profiles
WHERE is_default = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY user_id
LIMIT 20;
```

The query returned **zero rows**. This confirms no detected duplicate account defaults that would block the partial unique build on the validation branch.

## Validated DDL

The following statement was executed on the isolated branch:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS viewer_profiles_default_user_unique
  ON viewer_profiles (user_id)
  WHERE is_default = true;
```

`CREATE UNIQUE INDEX CONCURRENTLY` **must run outside a transaction**. The operational migration runner must execute this statement independently; it must not wrap the migration in a transactional block.

## Catalog Verification

The following query was run against `br-lingering-rice-a6fszepe`:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'viewer_profiles'
  AND indexname = 'viewer_profiles_default_user_unique';
```

| Index                                 | Catalog definition verified                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `viewer_profiles_default_user_unique` | `CREATE UNIQUE INDEX ... ON public.viewer_profiles USING btree (user_id) WHERE (is_default = true)` |

## Promotion Boundary

This validation branch is not a production deployment. **No production promotion has occurred, and no production promotion is authorized by this record.** A separate explicit production approval is required before any production rollout.

Before an approved rollout, the operator must repeat the duplicate preflight on the production baseline, confirm the target schema still matches this validation record, execute the concurrent statement outside a transaction, verify the `pg_indexes` entry on the production branch, and monitor index-build completion, profile update error rates, and profile-selection behavior. If production state has drifted, create and validate a fresh isolated branch before proceeding.

# Kryv Advertising Measurement Receipt Validation

## Status

**Production change status: pending explicit operator approval.** This document records an isolated Neon branch validation only. Advertising delivery remains hard-disabled, no production schema has changed, and **no public impression-recording endpoint has been added**.

## Why an Endpoint Is Not Yet Safe

The existing `ad_impressions` table can count qualified and completed delivery, but it does not contain an issuance-bound, expiring, replay-resistant receipt. A browser payload that names a campaign, break, creative, or status is not trustworthy enough to create a frequency-cap, budget, revenue, or accounting effect.

> A future measurement endpoint must accept only a short-lived server-issued decision receipt, validate the authenticated account and active profile against that receipt, consume it idempotently, and record only a policy-qualified transition. It must never trust a client-calculated impression, completion, revenue, or frequency decision.

The correct next step was therefore to validate the prerequisite receipt schema—not to add a write endpoint that could become unsafe if the global delivery flag were later changed without the signed-decision issuer and fraud controls.

## Production Baseline

| Area                       | Verified baseline                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Advertising runtime        | `AD_DELIVERY_RUNTIME_ENABLED = false`                                                                    |
| Decision endpoint          | Returns `ads_delivery_disabled` before candidate evaluation                                              |
| Existing impressions       | Holds delivery status, timestamps, and viewer/profile references but no receipt or idempotency authority |
| Public impression endpoint | Absent                                                                                                   |
| Production mutation        | None                                                                                                     |

## Isolated Validation Environment

| Property                     | Value                                |
| ---------------------------- | ------------------------------------ |
| Project                      | `bold-cake-75596541`                 |
| Parent branch                | `br-bold-waterfall-a6zmt608`         |
| Temporary branch             | `br-icy-river-a60m2ip8`              |
| Branch name                  | `ad-measurement-receipts-validation` |
| Expiry                       | 2026-08-27T12:00:00Z                 |
| Production database modified | No                                   |

## Validated Additive Schema

The temporary branch accepted an `ad_delivery_receipts` table with the following controls.

| Control                        | Validated design                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Decision authority             | A non-null, unique `decision_hash` binds a future signed decision to one receipt record        |
| Replay prevention              | `decision_hash` is unique; `consumed_at` records consumption                                   |
| Account binding                | A non-null `user_id` references the account authorized at issuance                             |
| Profile binding                | Optional `profile_id` permits future profile-aware decisions while preserving account scope    |
| Policy scope                   | `surface` is limited to `live`, `watch`, `cinema`, or `clip`                                   |
| Expiry                         | `expires_at` must be later than `issued_at`                                                    |
| Delivery transition vocabulary | Status is bounded to `issued`, `requested`, `qualified`, `completed`, `rejected`, or `expired` |
| Audit timing                   | Issued, consumed, qualified, completed, and creation timestamps are retained                   |
| Verification access path       | `(decision_hash, expires_at)` index supports bounded receipt verification                      |
| Investigation access path      | `(user_id, created_at DESC)` index supports accountable review                                 |

The table, all foreign keys, the status/surface/temporal constraints, unique decision hash, and both indexes were inspected on the temporary branch. The formal schema diff contained only the new receipt table, its constraints, indexes, and foreign keys.

## Prepared Artifact

The prepared migration is `lib/db/drizzle/0023_ad_delivery_receipts.sql`. It is explicitly **production-pending**. It must not be applied autonomously, and it must not be treated as authorization to enable any advertising behavior.

## Required Gates Before Any Future Endpoint

A future `POST /ads/impressions` path remains out of scope until all of the following are independently implemented, reviewed, and validated in an isolated release.

| Required gate                                       | Why it is required                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Server-issued, short-lived signed decision token    | Prevents clients from inventing a receipt, campaign, or qualified status                                      |
| Receipt creation transaction                        | Binds the token hash to a specific break, creative, account, profile, surface, and expiry before presentation |
| Authenticated account and active-profile comparison | Prevents cross-account and cross-profile receipt replay                                                       |
| Single-consumption transaction                      | Prevents duplicate calls from increasing frequency or revenue effects                                         |
| Qualification policy                                | Defines watched-duration, visibility, fraud, and error criteria on the server-authoritative path              |
| Reconciliation controls                             | Separates qualified delivery from campaign budget, creator share, and accounting movement                     |
| Consent and content-suitability rechecks            | Ensures a receipt cannot bypass consent, maturity, regional, or rights changes after issuance                 |
| Operator kill-switch drill                          | Demonstrates that the global disabled state blocks both decision issuance and measurement writes              |
| Abuse and invalid-traffic controls                  | Covers replay, bot, automation, and anomalous event patterns                                                  |

## Rollout and Rollback

No rollback is needed for the current work because production was untouched. If a future operator-approved rollout occurs, the receipt table must be deployed before any code references it. A rollback must first retain the global delivery kill switch, disable decision issuance and measurement writes, then separately review any destructive removal of the table or its audit records.

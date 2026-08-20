# Kryv Platform Entitlements and Free-Tier Advertising Policy

**Status:** Isolated Neon validation complete; **production rollout pending explicit operator approval**. **Advertising delivery remains disabled.**
**Scope:** A platform-wide entitlement model for free-tier and future ad-free access across **Cinema, Watch, and Live**.
**Production database status:** Unchanged. The clean disposable validation branch, `platform-entitlements-validation-v2` (`br-soft-heart-a6rd4ml4`), was created from production and is scheduled to expire automatically. The validated repository migration is `lib/db/drizzle/0022_platform_entitlements.sql`; it is explicitly production-pending and has not been applied to Neon production.

> **Policy distinction.** A creator-channel subscription is a relationship between a viewer and one creator. It is **not** evidence of an account-wide ad-free platform plan. Kryv must not infer global advertising eligibility from creator subscription records.

## 1. Current evidence

| Area                      | Verified state                                                                                                                                                                 | Consequence                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free-tier surfaces        | The existing ad-decision contract recognizes `cinema`, `watch`, `live`, and `clip`.                                                                                            | Any future eligibility resolver must produce one consistent account policy for Cinema, Watch, and Live while retaining surface-specific placement rules. |
| Delivery state            | `AD_DELIVERY_RUNTIME_ENABLED = false`; decisions return `ads_delivery_disabled` before candidate evaluation.                                                                   | No campaign, creative, impression, funding, revenue, or UI component can activate ad delivery at present.                                                |
| Creator subscriptions     | `subscriptions` is keyed to `user_id` and `channel_id`; its records represent creator memberships.                                                                             | Creator memberships must remain separate from platform plan/ad-free policy.                                                                              |
| Profile binding           | Viewer-profile selection now issues a short-lived, session-bound HttpOnly grant; future profile-aware ad decisions reject a profile ID that is not the granted active profile. | Profile ID cannot be trusted merely because it is owned by the signed-in account.                                                                        |
| Existing ad control plane | Campaign, creative, rule, break, funding, impression, consent, and revenue-movement data structures already exist.                                                             | The missing component is a platform-level entitlement source, not a replacement advertising database.                                                    |

## 2. Proposed entitlement model

Kryv should treat **absence of an active ad-free entitlement as free-tier eligibility**. This avoids duplicating a `free` row for every account while still allowing an explicit, audited, time-bounded ad-free override in the future. The resolver must be server-only; no client-provided plan, subscription, profile, or payment flag can establish eligibility.

| Decision outcome                             | Server interpretation                                                      | Client outcome while delivery is disabled                     |
| -------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| No account or no active platform entitlement | Free-tier context, subject to consent, safety, profile, and surface policy | No ad is rendered because the global delivery gate is false.  |
| Active account-wide ad-free entitlement      | Ad-free context                                                            | No ad container, decision, impression, or fallback placement. |
| Expired, revoked, or invalid entitlement     | Free-tier context after server audit/reconciliation                        | No ad is rendered while the delivery gate is false.           |
| Creator-channel subscription only            | Creator support relationship, not account-wide plan                        | No change to platform advertising eligibility.                |
| Locked or inactive viewer profile            | Profile access is not established                                          | No profile-aware advertising decision.                        |

## 3. Proposed additive data contract

A future additive migration should create one platform-level entitlement record type with an **account owner**, **eligibility state**, **effective window**, **review/audit context**, and **revocation path**. The data model should explicitly support a named entitlement such as `ad_free`, but it must not create a public client mutation endpoint.

| Required policy concept  | Why it is required                                                                      | Prohibited shortcut                                                            |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Account owner            | Resolves eligibility once for all Cinema, Watch, and Live surfaces                      | Storing an ad-free flag in local storage or a profile object                   |
| Effective period         | Allows an entitlement to end naturally without manual cleanup                           | Treating a stale payment, invoice, or creator subscription as perpetual access |
| Revocation/audit context | Supports operator investigation, dispute handling, and safety recovery                  | Silent deletion or client-controlled reversal                                  |
| Grant source             | Distinguishes an approved platform plan, operator grant, promotion, or recovery action  | Guessing eligibility from a creator tier, tip, or wallet balance               |
| Server-only mutation     | Preserves authorization, re-authentication, provider verification, and audit boundaries | Exposing a browser endpoint that accepts a plan name or payment claim          |

## 4. Required future decision sequence

Before any ad candidate can be returned, a future decision service must complete the following **server-side** sequence in order. The current runtime gate executes before all of these steps and must remain the first effective gate until a separate launch review approves a change.

| Order | Required check                                                                  | Fail-closed result                                                            |
| ----- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1     | Global operator/runtime delivery kill switch                                    | `ads_delivery_disabled`                                                       |
| 2     | Canonical surface and current user/session context                              | `invalid_surface_context`                                                     |
| 3     | Account-wide platform entitlement                                               | `ad_free_entitlement_active`                                                  |
| 4     | Session-bound active profile grant where profile context is requested           | `active_profile_grant_required`                                               |
| 5     | Profile maturity, rights, regional, and content-suitability policy              | `profile_or_content_policy_restricted`                                        |
| 6     | Consent mode and data-minimization policy                                       | `ads_consent_required` or a separate explicitly approved contextual-only path |
| 7     | Atomic frequency/pod/cooldown evaluation                                        | `frequency_cap_reached`                                                       |
| 8     | Campaign, funding, advertiser, creative-review, and creative safety eligibility | A specific non-delivery reason                                                |
| 9     | Signed, short-lived decision and idempotent measurement authority               | `decision_authorization_unavailable`                                          |

## 5. Surface placement policy

The account-level entitlement answers **whether** a free-tier viewer is eligible. It does not decide **where** an advertisement is allowed. Surface placement remains separately constrained.

| Surface | Future safe placement candidates                                          | Never place in                                                                                            |
| ------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Cinema  | Clearly disclosed pre-play placement or separate labelled collection unit | Profile chooser, PIN/lock interface, maturity warning, title restriction state, playback error/retry flow |
| Watch   | Clearly disclosed pre-play placement or labelled sidebar/feed placement   | Search result semantics, comments, creator action controls, organic recommendation labels                 |
| Live    | Clearly disclosed pre-play placement or a separate browse/display module  | Chat composer, chat eligibility message, moderation/report controls, follow/subscription/tip/gift actions |

## 6. Isolated Neon validation plan

| Stage                                  | Current state                                                                                                                                         | Production effect |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Schema reconnaissance                  | Complete: creator subscriptions and platform-level entitlement needs were distinguished.                                                              | None.             |
| Disposable branch creation             | Complete: clean branch `br-soft-heart-a6rd4ml4` is isolated and auto-expiring.                                                                        | None.             |
| Additive migration preparation         | Complete: table, check constraints, audit/revocation fields, and resolver indexes were applied and inspected only on the clean temporary branch.      | None.             |
| Repository migration and ORM alignment | Migration `0022_platform_entitlements.sql` prepared; ORM and decision-resolver runtime work remain deliberately deferred until production approval.   | None.             |
| Production completion                  | Explicitly not started. It requires user confirmation after branch verification.                                                                      | None.             |
| Runtime delivery activation            | Explicitly out of scope. It requires a separate safety, privacy, fraud, measurement, finance-reconciliation, and operator-kill-switch release review. | None.             |

## 7. Release gates before any future activation

An entitlement table alone is insufficient. Before advertising can leave its disabled state, Kryv must demonstrate all of the following in an isolated, audited release process: account-level entitlement tests; active-profile grant tests; no cross-profile leakage; personalized/contextual consent behavior; atomic frequency caps; reviewed advertiser and creative state; content/maturity/region screens; signed idempotent event recording; fraud and invalid-traffic controls; no client-calculated qualification or revenue; reconciliation from qualified delivery to accounting movement; operator kill-switch drills; accessibility of disclosure, feedback, mute, and skip controls; and rollback/recovery monitoring.

## 8. Implementation decision

The correct next implementation step is **not** to activate delivery and not to misuse creator subscriptions as a platform plan. The additive, server-owned entitlement migration has now been verified on the clean isolated Neon branch and recorded as `0022_platform_entitlements.sql`; the next step is explicit operator approval before any production completion. Until that approval, the free-tier advertising presentation components and decision route remain structurally ready but operationally disabled.

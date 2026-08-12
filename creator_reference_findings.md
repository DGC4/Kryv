# Creator and owner-control reference findings

## Kick Creator Dashboard — Revenue view

The user approved review of their currently open Kick Creator Dashboard as a product-structure reference. The observed revenue view uses a creator sidebar that groups stream operation, stream credentials, revenue, achievements, studio, analytics, moderation, community, and rewards. Its revenue page is built around a clear next-payout summary with cadence, high-level subscription statistics, a period selector, earnings-category cards, a trend chart, and a chronological history table.

Kryv should adopt the *control model*, not copy the visual brand or payment rails. The corresponding crypto-first structure will be: a creator wallet/revenue home; balances by supported asset and USD reference value; a locked, available, and scheduled-payout view; transparent fee and net-settlement breakdown; invoice and settlement activity; a payout-address vault; schedule preferences; and an eligibility / achievement rail. The owner version should add cross-creator supervision, payout review, exception queues, reconciliation, risk holds, provider-event traceability, and audit evidence.

No settings, payouts, credentials, or account data were changed during the reference review.

## Kick Creator Dashboard — Achievements view

The approved reference presents achievements as progressive, time-bounded paths. Each path groups a small number of transparent metrics, displays current-versus-target progress, and distinguishes eligibility from automatic approval. The observed examples pair recent qualified subscriptions, rolling average viewers, live hours, unique chatters, follower totals, and account-security requirements.

Kryv should use the same approachable progression pattern without copying the exact thresholds or making earnings dependent on arbitrary growth. The initial payout-readiness path should be intentionally modest: confirmed channel identity, one completed live session, a minimum number of active-live minutes, verified creator payout address, two-factor authentication, and no unresolved safety or payment hold. These milestones should unlock *payout eligibility and creator tools*, not promise verification, cash, or any virtual-point conversion. The owner retains final review authority, every criteria calculation is server-derived, and every exception is auditable.

## Twitch Creator Dashboard — Home view

The user-approved Twitch dashboard reference is organized as a persistent creator operating system rather than a single analytics screen. Its primary navigation separates stream operations, analytics, community, content, monetization, moderation, settings, viewer rewards, tools, learning, and safety. The home view converts this into a personalized readiness rail: incomplete onboarding actions, completed milestones, actionable community prompts, safety configuration, stream scheduling, channel settings, and discoverability guidance are all visible without forcing the creator to search through settings.

Kryv should adopt this creator-first operating pattern in a distinct visual system. The Kryv Creator Studio sidebar should contain **Live Control**, **Revenue & Wallet**, **Achievements**, **Analytics**, **Community & Moderation**, **Content & Clips**, and **Settings & Security**. A concise home overview should show only the next meaningful tasks: set a payout address, complete two-factor authentication, meet payout-readiness milestones, configure a live title/category, complete a first broadcast, and review settlement status. Revenue or achievement status must never create a client-side entitlement; all status remains server-evaluated.

## Twitch Creator Dashboard — Monetization navigation

The approved Twitch reference places revenue-adjacent functions inside a dedicated Monetization group with distinct entries for viewer support, community-linked value, subscriptions, and setup. This is a useful information-architecture lesson: revenue reporting, earning mechanisms, and account readiness should not be mixed into general channel settings. The observed destination did not expose personal payout data during this read-only review, so no payout details were collected or changed.

For Kryv, the equivalent group should be **Revenue & Wallet** with separate Overview, Support Activity, Subscriptions, Payout Settings, and Payout History sections. The setup section should communicate readiness and missing requirements, not expose unverified wallet data or automatically request settlement.

## DGC Arcade implementation comparison

DGC Arcade provides useful structural reference for a specialty creator hub and an owner financial overview: platform-level balance summary, selected-period activity, user-level balance detail, transaction feed, an owner session boundary, creator earnings history, and clear pending-versus-available payout states. These concepts are transferable to Kryv once renamed and narrowed to lawful creator monetization.

Kryv must **not** carry over several implementation choices from the reference. The reviewed creator UI initializes and saves payout coin/address data in browser local storage, and its payout request accepts a client-supplied amount/address. Kryv will instead persist an encrypted payout-address record server-side, return only a masked address to the client, require a confirmed-address change flow, calculate available amount from its ledger on the server, create an approval-gated payout request, and call any provider withdrawal mechanism only from the worker after an owner-approved state transition. Creator balances will not share gaming, promotional, referral, or generic user-wallet buckets.

## Kryv finance foundation assessment

Kryv already has the right first-class records for an invoice-led system: payment intents, provider event idempotency, tips, subscriptions, creator balances split into pending/available/held states, payout requests, payout approvals, feature flags, and a generalized audit log. Its source of truth can remain the existing verified-callback flow; no creator UI should mutate those records directly.

The foundation still needs a creator-finance extension before withdrawals can be activated. The current payout request has only a plain destination reference and lacks a separate encrypted address record, asset-network validation state, destination-change confirmation, selected payout cadence, payout batch/run identifier, fee/quote snapshot, settlement transaction URL, reviewer separation policy, and immutable balance-movement ledger. These are the specific controls to add rather than creating an informal ‘bank’ balance or copying browser-local wallet storage.

## Kryv settlement and Creator Studio assessment

Kryv’s verified callback path is already the correct authority boundary: it rejects unconfigured or invalid callbacks, writes a provider event idempotently, settles the matching payment intent once, grants subscription entitlement only after completion, records a completed tip, and increases the corresponding creator crypto balance on the server. This is the foundation to preserve.

The current Creator Studio already has a sidebar-tab pattern, live credentials, live preview, chat safety, engagement, content, settings, and analytics. Revenue & Wallet and Achievements should be added as first-class tabs in this same Studio rather than as a separate unconnected dashboard. The legacy client import of a card icon in a visual file is not a payment integration and will be replaced with crypto-appropriate language/icons in the new revenue surface.

## Production database reconciliation — 2026-08-11 EDT

A read-only Neon query confirmed that the deployed `payment_intents`, `payment_events`, `tips`, `creator_balances`, `payout_requests`, and `payout_approvals` tables have the expected columns from the checked-in Kryv schema. Their current record counts are zero, `crypto_commerce` is `false`, and `ads_delivery` is `false`. This is the appropriate pre-launch state: no invoice, balance, payout request, or approval exists to migrate or reconcile, and the new creator-finance records can be introduced forward-only without changing a live financial balance.

## Implementation prerequisites confirmed

Kryv channels have a one-to-one owner relationship, so the creator finance records can be scoped safely by `channel_id`. The owner router already requires permanent-owner authorization, supports audited feature-flag updates, and has a clear tabbed console pattern. The Plisio client already protects its secret on the server, constrains the supported asset list to BTC/LTC/ETH/DOGE, uses HTTPS JSON callbacks, and has a bounded request timeout for invoice creation. The payout extension can build on these controls without introducing any client-held provider credential.

# Kryv Platform Expansion Roadmap

**Prepared:** August 11, 2026  
**Scope:** Creator onboarding and analytics, moderated chat, native clips, live engagement, monetization, and discovery/retention.  
**Implementation baseline:** `main` at `3a92637`, with the working FastPix creation, ingest, playback, viewer-count, and discovery flow preserved.

## Strategic outcome

Kryv should become a coherent **Live + Watch + Cinema** platform rather than a broad collection of dormant tables. The release sequence below wires the highest-value existing schema into carefully bounded creator and viewer experiences while preserving the current FastPix flow. The first releases concentrate on trust, operational quality, and retention; the payment release is intentionally gated behind the account, legal, and business decisions necessary to move money safely.

> **Safety principle:** The client can request an action, but the server is the authority for channel ownership, moderation, virtual balances, entitlements, and every payment state change.

## Delivery sequencing

| Release | Scope and measurable outcome | Dependency | Estimated implementation effort | Delivery gate |
|---|---|---:|---:|---|
| **R0 — Data guardrails** | Add invariant constraints, query indexes, migration verification, and event/idempotency foundations | Existing Neon schema | 2–3 engineer days | All production data passes duplicate and foreign-key checks |
| **R1 — Creator-ready live** | Finish settings save, onboarding status, sessions, audience/chat analytics, and mobile dashboard refinement | R0 | 4–6 engineer days | Channel creation, FastPix preview, and settings save pass regression tests |
| **R2 — Moderated chat** | Roles, bans, timeouts, slow mode, delete, commands, audit actions, and real-time delivery | R0; realtime choice | 7–12 engineer days | Permission, timeout, rate-limit, and reconnection tests pass |
| **R3 — Native clips** | Create, process, publish, play, share, and browse clips from eligible VOD/live recordings | R0; FastPix VOD linkage | 6–9 engineer days | Webhook-driven clip-ready state and shareable public playback pass end-to-end test |
| **R4 — Engagement foundation** | Points, rewards, polls, predictions, raids/hosts, and creator controls | R0 and R2 | 10–16 engineer days | Transactional balance/voting/settlement tests pass; no duplicate actions possible |
| **R5 — Creator monetization** | Stripe connected-account onboarding, tips, one subscription tier, entitlement sync, receipts, payout status, and operator controls | R0; Stripe account and policy decisions | 15–25 engineer days, excluding provider verification | Full sandbox webhook, refund, dispute, and payout-failure test suite passes before any live charges |
| **R6 — Retention and discovery** | Search, followed-live row, notification preferences, clip discovery, tags, and recommendations | R1, R3, R4 | 5–8 engineer days | Search/filter correctness, notification idempotency, and responsive UI checks pass |
| **R7 — Release hardening** | Security review, browser/mobile regression, load probes, observability, documentation, production rollout | R1–R6 | 5–8 engineer days | Staged rollout checklist is complete with no regression in FastPix go-live flow |

The effort bands above are engineering planning ranges, not delivery promises. The critical-path size is dominated by the payment and real-time choices, account verification, and the depth of moderation rules rather than by user-interface construction.

## R0 — Data guardrails and migration plan

The first migration should turn the current schema into a reliable source of truth before feature traffic is introduced. The production audit found no current duplicate channel-point, poll-vote, prediction-entry, or active-subscription pairs, which makes it safe to add the constraints below after branch validation.

| Domain | Constraint or index | Why it is required |
|---|---|---|
| Channel points | Unique `(channel_id, user_id)`; non-negative balance check | Prevents duplicate wallet rows and negative virtual balances |
| Polls | Unique `(poll_id, user_id)`; choice belongs to poll validation in a transaction | Prevents duplicate or cross-poll voting |
| Predictions | Unique `(prediction_id, user_id)`; outcome belongs to prediction validation | Prevents duplicate entries and balance exploits |
| Subscriptions | Partial unique index on active `(user_id, channel_id)` | Prevents multiple simultaneously active subscriptions for the same channel |
| Chat | `(channel_id, created_at DESC, id DESC)` index; active-timeout/ban indexes | Supports cursor pagination and per-message moderation checks |
| Clips | Public channel/time and FastPix clip-media identity indexes | Supports channel pages, discovery, and idempotent transform webhooks |
| Payments | Immutable `payment_events` table with provider-event unique ID; provider object IDs on tips/subscriptions | Makes payment webhook replay safe and auditable |
| Analytics | Stream session and viewer-session query indexes | Enables channel-level dashboards without scanning all sessions |

All migration work will first run on a Neon branch. It must be verified there, compared against production schema, and then explicitly confirmed by the user before being promoted to the main production branch.

## R1 — Creator onboarding and analytics

The creator dashboard already contains the correct user journey—create a channel, generate FastPix credentials, configure OBS, observe status, and preview the HLS output. R1 makes the journey complete without altering the provisioning routes.

| Capability | Creator experience | Server and data work |
|---|---|---|
| Saved channel settings | Editable display name, mature-content choice, title, category, tags, and a clear saved state | Owned-channel PATCH contract, validation, audit-friendly timestamps |
| Go-live readiness | A checklist that reflects credentials, title/category, FastPix state, and current preview | Derived status endpoint; no replacement of FastPix webhooks |
| Session history | Recent broadcasts showing duration, peak viewers, average viewers, chat volume, and VOD/clip availability | Query `stream_sessions`, linked VOD media, and live state |
| Analytics | Period views, follower growth, chat activity, peak/average viewers, and top content | Aggregated read models built from sessions, follows, chats, and viewer sessions |
| Mobile dashboard | Horizontally safe controls, compact status tiles, clear stream-key warnings, and accessible forms | Responsive regression tests at phone, tablet, and desktop widths |

## R2 — Moderated chat and real-time delivery

Moderation must be server-enforced. Every message submission will evaluate channel ownership/moderator permissions, a user's active channel ban, active timeout, channel slow mode, a per-user message rate, message length, and command handling. Moderator actions require an immutable audit trail and visible reasons. Viewer chat remains readable while only authenticated users may write.

### Real-time delivery options

The existing three-second HTTP polling is a safe compatibility fallback but will not scale efficiently for a mature chat product. The delivery architecture should be selected before R2 implementation.

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---|---|
| **Keep short-interval polling** | Simplest and works on the current API; higher request load and less immediate moderation feedback at scale | Low infrastructure cost; higher API/database load | Low |
| **Server-sent events backed by a shared publish channel** | Efficient one-way message delivery, native browser support, and keeps sending as authenticated HTTP; needs connection lifecycle and shared pub/sub management | Moderate, depends on host/pub-sub | Medium |
| **Managed real-time provider** | Fastest path to scalable fan-out, reconnects, presence, and moderation events; introduces provider cost and vendor dependency | Usage-based | Medium |
| **WebSocket service with external pub/sub** | Maximum protocol control and rich bidirectional features; requires persistent process operations, horizontal fan-out, backpressure, and observability | Moderate to high | High |

The first build can implement R2's authorization and moderation API with the existing polling client as a temporary compatibility path. A delivery choice is still required before deploying full high-concurrency real-time chat.

## R3 — FastPix-native clips

Kryv should treat clips as distinct published video assets, not timestamp bookmarks. FastPix can create a new on-demand asset by taking a start and end time from an existing media ID, then asynchronously emits ready status for the derived asset. Each result receives its own `mediaId` and `playbackId`, and FastPix advises webhook-driven readiness. [1]

The clip workflow is therefore:

1. A creator or authorized viewer chooses an eligible source VOD or recorded live session.
2. Kryv validates ownership/eligibility, range limits, and availability of the source FastPix on-demand media ID.
3. The server requests the FastPix clip transform, stores a pending clip record with provider identities, and immediately returns a processing state.
4. The existing FastPix webhook handler recognizes the clip media event, verifies its signature, updates the clip record idempotently, and publishes the result only after it is ready.
5. Kryv exposes a mobile-friendly clip page, HLS player, open-graph-ready thumbnail/title, share link, channel clip shelf, and discovery feed.

The initial release should limit user-generated clips to a policy-controlled duration, use public playback only for public source material, and keep an owner/moderator unpublish action. A later release can add clip reactions, automatic highlight suggestions, captions, and cross-post exports.

## R4 — Engagement foundation

Kryv's first engagement release should use points strictly as non-transferable, non-cash virtual loyalty value. It should prioritize the features that create a visible loop without introducing financial or settlement risk.

| Subsystem | First release | Server safeguards |
|---|---|---|
| Channel points | Heartbeat-based earning with cooldown; viewer balance; creator-enabled switch | Transactional increments, one balance per viewer/channel, rate/cooldown checks, no cash conversion |
| Rewards | Creator creates/pauses a reward; viewer redeems; creator fulfills or cancels | Balance debit and redemption insert in one transaction; per-user/per-stream limits |
| Polls | Creator starts/stops a poll; one vote per viewer; live results | One vote constraint; atomic vote increments; ownership check |
| Predictions | Creator creates, locks, resolves, or cancels a virtual-points prediction | Balance reservation/settlement in transactions; no real-money staking; outcome validation |
| Raids and hosts | Creator selects a public live target; viewer transition is presented at stream end | Destination eligibility, audit log, idempotent completion, no forced navigation without viewer intent |
| Goals and alerts | Creator-configured lightweight goal and alert surfaces | Creator ownership validation and bounded media inputs |

R4 excludes cash-like points exchange, betting, predictions for cash value, or automatic transfers. Those are not required for a compelling initial loyalty system and substantially increase regulatory and abuse risk.

## R5 — Monetization architecture and release gate

> **Finance disclaimer:** I am an AI, not a licensed financial advisor. This is technical product analysis, not financial or legal advice; confirm your business model, tax, consumer-protection, and payout obligations with qualified counsel and finance professionals before accepting live payments.

A creator marketplace needs more than a `tips` row and an `active` subscription record. It needs provider-account identity, product and price IDs, checkout state, signed webhook fulfillment, receipts, refunds/disputes, payout status, and operator visibility. Stripe Connect is designed for platforms that route payments between end customers and connected accounts; recurring creator subscriptions require connected-account and charge-model choices, and payment state must be driven by webhook events rather than browser redirects. [2] [3]

| Design decision | What Kryv must decide before activation | Safe default for a test implementation |
|---|---|---|
| Payment processor | Stripe Connect or another provider | Stripe Connect in test mode |
| Creator account model | Standard, Express, or Custom connected accounts | Express, subject to legal/compliance review |
| Charges | Direct or destination charges | Destination charges if Kryv is merchant of record; confirm responsibility first |
| Creator revenue share | Platform fee percent and responsibility for provider fees/refunds/disputes | A test-only configurable application fee; no public revenue-split claim before approval |
| Currency and countries | Launch countries, settlement currency, tax handling | One currency and one supported launch jurisdiction |
| Product catalog | First subscription price, benefits, and tip floor/ceiling | One creator subscription tier plus one-time tips |
| Entitlements | What a subscriber receives | Channel support badge and ad-free/bonus entitlement only after provider confirmation |
| Payout operations | Frequency, minimum threshold, failure support process | Provider-managed payout schedule with status visibility |

The live implementation will not create charges, transfer funds, activate a production checkout, or configure a live provider account until the user supplies the business decisions and the necessary credentials. A test-mode implementation can begin once test credentials and webhook secret are supplied.

## R6 — Retention and discovery

The final product layer turns new creator activity into viewing loops. It includes a true query-backed search surface across channels, categories, videos, and clips; a personalized Followed Live row; notification preference controls; tags/language/mature filtering; shareable clip discovery; and an explainable first-pass recommendation such as category/viewing adjacency. Notifications are stored first and can be delivered in-app before email/push channels are introduced.

## Required user decisions

The following questions block only the architecture they affect; R0 and R1 can begin without them.

| Decision required | Why it changes implementation | What is needed from you |
|---|---|---|
| Real-time chat option | Determines deployment, client protocol, and connection observability | Choose polling temporarily, server-sent events, managed real-time, or WebSockets with pub/sub |
| Stripe provider setup | Needed to execute any test or live monetary action | Enable Stripe, provide test credentials through the secure integration flow, and select test mode first |
| Creator payment model | Changes charge routing, compliance responsibilities, and payout behavior | Confirm Stripe Connect account type, country/currency, platform fee, refund/dispute owner, payout cadence |
| Subscription offer | Determines product/price creation and entitlements | Confirm the first price, billing period, and subscriber benefits |
| Clips policy | Controls abuse/risk and source eligibility | Confirm maximum clip length and whether any signed-in viewer or only creator/moderators may create clips |
| Chat rules | Controls UX and data model | Confirm default slow-mode interval, timeout presets, and whether creators can appoint moderators immediately |

## Implementation safeguards

The codebase will retain FastPix `active` webhook behavior as the single source for making a channel public/live. No feature endpoint will be allowed to flip `isLive`, provision a new channel outside the existing channel creation flow, or expose a stream key to any non-owner. Every database change will be tested on a Neon branch first. Each release will run contract, build, responsive, and regression checks before a single GitHub push.

## References

[1]: https://fastpix.com/docs/video-on-demand/clip-and-trim-videos.md "FastPix — Clip and trim videos"
[2]: https://docs.stripe.com/connect/subscriptions "Stripe — Create subscriptions with Stripe Billing"
[3]: https://docs.stripe.com/webhooks "Stripe — Receive Stripe events in your webhook endpoint"

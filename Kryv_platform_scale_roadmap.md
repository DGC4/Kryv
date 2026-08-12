# Kryv Platform-Scale Execution Roadmap

**Author:** Manus AI  
**Status:** Sequenced execution plan following the crypto-only controlled-launch release  
**Scope:** Kryv Live, Watch, Clips, Cinema, creator operations, platform resilience, and advertising  
**Operating principle:** Money, entitlements, live state, and moderation outcomes remain **server-authoritative** at every phase.

## Executive position

Kryv now has the foundation for a single payment narrative: **BTC, LTC, ETH, and DOGE only; no card checkout, no Stripe, no Connect flow, and no client-side balance authority.** The current release exposes an authenticated channel-support entry point, creates server-side invoice records only when commerce is enabled and configured, and keeps settlement dependent on a verified provider callback. The resulting operating model is deliberate: public users can discover crypto support, but the owner retains an audited server-side kill switch until production credentials, callback monitoring, and incident handling are ready.

The next work should not be approached as a broad visual refresh. It should be delivered as a sequence of closed operational loops: **observe an event, decide it on the server, record it durably, publish it in real time, and expose an owner control or audit trail.** This sequence protects the existing live path—channel creation, secure ingest, signed lifecycle event, server live-state reconciliation, and public HLS playback—while moving Kryv toward a multi-surface entertainment product.

| Current release baseline | Status | Why it matters |
|---|---:|---|
| Stripe/card-provider source paths | Removed from active API, frontend, contracts, and dependencies | The public and backend payment story is now crypto-only. |
| Channel tips and subscriptions | Invoice endpoints, generated client hooks, and viewer support panel exist | Checkout remains disabled until controlled activation; no entitlement is client-granted. |
| Commerce activation | Owner-only feature-flag API and Console controls | The `crypto_commerce` gate is auditable and can be closed immediately. |
| Payment settlement | Intent and event ledger remain server-controlled | Creator balances and viewer entitlements must change only from a verified settlement callback. |
| Live lifecycle | Signed FastPix webhook route is active | The platform already rejects unsigned lifecycle signals and can preserve current live-state authority. |
| Cinema publishing | Governed owner workflow, rights windows, asset records, and readiness gates exist | DRM, entitlements, and catalogue growth can be added without bypassing rights control. |

## Controlled activation: complete before public crypto checkout

The public Support surface should stay visible, but invoice creation must remain disabled until the operational checklist below is complete. This is not a marketing delay; it is the guardrail that prevents a creator balance or viewer entitlement from being changed before a payment is cryptographically confirmed and observable. Plisio’s invoice documentation supports callback URLs, unique merchant order numbers, invoice status delivery, and JSON callback verification; its withdrawal documentation separately supports destination wallets and operation tracking.[1] [2]

| Activation gate | Required evidence | Owner action | Exit condition |
|---|---|---|---|
| Provider configuration | Production `PLISIO_SECRET_KEY`, `KRYV_APP_URL`, and `PLISIO_CALLBACK_URL` are set as protected environment values | Configure the values in the deployment environment, with the callback set to `https://kryv-backend.onrender.com/api/webhooks/plisio?json=true` | The disabled checkout endpoint no longer reports provider configuration as missing. |
| Callback security | A test callback has a valid JSON-mode HMAC, invalid signatures are rejected, and duplicate delivery is idempotent | Retain the test evidence and confirm the callback event is stored once | A paid test invoice updates exactly one intent/event sequence and no duplicate credit occurs. |
| Ledger reconciliation | Invoice, callback event, creator balance, and viewer subscription record can be reconciled by order number | Review the owner audit / database view for the test sequence | Every credit is traceable to an immutable provider event and an internal payment intent. |
| Failure handling | Expired, underpaid, cancelled, and provider-unavailable flows leave no entitlement or balance credit | Exercise non-payment paths in the provider test mode | Each path has an explainable terminal status and user-safe message. |
| Operational ownership | A named owner is able to disable `crypto_commerce` and retrieve the event trail | Use the Owner Console Operations tab in a staging-like verification first | The kill switch takes effect before a new invoice is created and the change is audited. |

> **Activation rule:** enable `crypto_commerce` only after the provider configuration and verified-callback test are complete. The control is a launch gate, not a substitute for those checks.

The planned payout surface should remain a separate, owner-reviewed workflow. A payout request must identify the creator, approved destination address, selected BTC/LTC/ETH/DOGE asset, amount, fee treatment, provider operation ID, transaction URL, reviewer, and final settlement state. It must never reuse card-account or legacy creator-payment-account data. The first launch should keep payout execution behind two-person review or an owner approval queue, even if the provider supports programmatic withdrawal.[2]

## Phase 1 — Real-time live interaction and operational telemetry

Kryv’s present chat polling is appropriate for early validation but not for high-volume rooms. The immediate target is not merely to replace a timer; it is to define a durable event envelope that can be replayed, moderated, measured, and delivered to both the page and the owner console. Server-Sent Events are one-way and can provide a low-risk read-path migration while REST remains the authoritative write path, whereas WebSockets offer two-way interaction without polling but require slow-consumer and backpressure controls.[7] [8]

| Workstream | Sequence | Server authority and scale guardrail | Acceptance signal |
|---|---|---|---|
| Chat event contract | Define `message.created`, `message.removed`, `chat.settings.updated`, `poll.updated`, `prediction.updated`, `viewer.count.updated`, and `stream.state.updated` envelopes with event IDs and timestamps | Persist the authoritative action first; publish only the normalized, permission-safe projection | A reconnect can request events after a last-seen ID without duplicate message rendering. |
| SSE bridge | Add a read-only, authenticated-or-public-by-policy channel event stream while retaining the existing REST chat-post route | Enforce channel-scoped authorization, keepalive comments, cursor replay, connection caps, and metrics | A viewer receives chat and engagement changes without 3-second polling. |
| Managed real-time decision | Before multiple API instances, select a shared pub/sub service or deploy a dedicated WebSocket gateway with a shared broker | Never fan out from in-process memory once horizontally scaled; rate-limit joins, sends, and resends | Events published by one instance reach viewers connected to another instance. |
| Moderation in the stream | Publish only after server-side message validation and moderation policy evaluation; issue a removal event when an already-visible message is removed | The client cannot hide, restore, or override a moderation decision | Moderator actions are visible in chat within the real-time SLO and are auditable. |
| Live telemetry | Receive provider lifecycle events as the live-state authority and add a separate stream-health event store | Keep ingest provider names and endpoint details private from public screens | The Creator Studio shows last lifecycle event, latency, bitrate/dropped-frame health where available, and actionable status. |

A managed real-time layer is preferred once Kryv needs multi-instance delivery, room-scale fan-out, presence, replay, and regional resilience. If a self-hosted WebSocket gateway is selected, it should begin only after a shared broker, bounded per-socket queues, authenticated channel membership, message-size caps, reconnection tokens, and load tests are in place. This avoids the common failure mode where a live chat works with one node but silently fragments when the service scales.

The first observability dashboard should establish the following service-level indicators. They are not vanity counters; each one corresponds to an operator decision.

| Indicator | Definition | Initial alerting purpose |
|---|---|---|
| Go-live success rate | Channel stream attempts that reach `active` within an agreed launch window | Detect ingest, signature, or lifecycle reconciliation regressions. |
| Live lifecycle lag | Time from signed provider event receipt to Kryv live-state update | Ensure discovery and Creator Studio do not drift from broadcast truth. |
| Chat delivery lag | Server persistence timestamp to client receipt timestamp, measured at percentiles | Detect an unhealthy real-time path before rooms visibly stall. |
| Chat rejection / moderation rate | Rejected or removed messages divided by attempted messages | Identify spam attacks, false positives, or policy changes. |
| Payment completion rate | Completed verified invoices divided by invoices started, segmented by coin and error reason | Separate user abandonment from configuration or callback faults. |
| Webhook processing lag and retry count | Delivery receipt to durable event record, plus idempotent duplicate count | Detect provider delivery, database, or signature-validation trouble. |

## Phase 2 — Player engagement, clips, and discovery

The next viewer product increment should make the existing server-side engagement features feel native to a live player rather than like isolated dashboard controls. Channel points remain virtual and non-cash; they must not be convertible to tips, subscriptions, crypto, or payouts. Polls and predictions should visibly reflect server-confirmed state, timers, eligibility, and moderation outcomes rather than optimistic local balance changes.

| Capability | Implementation sequence | Non-negotiable control | Done when |
|---|---|---|---|
| Player engagement rail | Render channel points, polls, predictions, milestones, and creator notices beside or beneath the player using the Phase 1 event envelope | Points, vote counts, prediction entry, and winner settlement are all calculated and persisted on the server | A viewer joining late sees the same authoritative poll/prediction state as existing viewers. |
| Creator controls | Add a compact Creator Studio control surface to start/end polls, resolve predictions, post notices, and configure chat modes | Role permissions are channel-scoped, expiry-aware, and written to the audit trail | A moderator cannot perform creator-only financial or content-publication actions. |
| Authorized viewer clips | Extend clip eligibility beyond owner-only VOD clips with a server-issued eligibility rule: live/replay availability, rights status, creator policy, time-window bounds, and rate limit | Clip creation is an authorized request, not a client-provided media URL or arbitrary timeline instruction | An eligible viewer can request a bounded clip, and an ineligible request is safely rejected with no media exposure. |
| Clip review and provenance | Store source playback ID, source time range, requesting user, policy decision, processing job ID, and moderation/publication state | Do not publish a clip until the source-rights and moderation policy is satisfied | Every public clip can be traced to a lawful source and reviewed action. |
| Discovery ranking v1 | Move from raw viewer-count sorting to an explainable blend of live status, category adjacency, followed creators, recent verified engagement, recency, and safety/risk demotions | Ranking features are server-produced; no client-side promoted ordering | Each discovery rail can explain why an item was selected and respects privacy/safety exclusions. |

FastPix documents signed playback, authenticated ingest, auto live-to-VOD archiving, DVR, and mid-event clipping capabilities.[3] Kryv should use those primitives only through its own entitlement, rights, and audit layer. FastPix’s media capability is not a substitute for Kryv’s policy decisions: the platform must decide who can initiate a clip, who can view it, and whether a source is entitled to be republished.

## Phase 3 — Production resilience and deployment posture

Kryv’s current managed deployment is effective for rapid iteration but the free compute tier is not an acceptable steady-state home for live lifecycle webhooks, account actions, or payment callbacks. Render documents that free web services spin down after 15 minutes without traffic, can take about a minute to wake, may restart, cannot scale beyond a single instance, and are explicitly not intended for production applications.[6] A synthetic keep-alive loop is not the correct remedy; it hides the operational condition while leaving restarts, single-instance availability, and service limits unresolved.

| Priority | Production change | Rationale | Validation |
|---:|---|---|---|
| 1 | Move the API service to a paid Render instance type and set a defined service budget | Removes free-instance spin-down constraints and creates a supportable availability baseline | A cold-start test is no longer part of normal webhook or checkout behavior. |
| 2 | Add health, readiness, dependency, and version endpoints with external uptime monitoring | Distinguish process health, Neon reachability, provider reachability, and deployed revision | An alert includes the affected dependency and latest release identifier. |
| 3 | Introduce a durable job / event processing path for retries, clip work, notification delivery, and non-blocking reconciliation | HTTP handlers should acknowledge verified events quickly and never perform long media work inline | A retry survives a process restart without duplicate business effects. |
| 4 | Establish release protection: build, typecheck, contract generation, migration review, endpoint smoke test, and rollback evidence | Prevent a frontend change from breaking the live or payment path | Every deploy has recorded verification results and an identified rollback revision. |
| 5 | Prepare scale-out only after shared real-time transport and connection-safe session behavior exist | A second API instance must not partition chat, presence, or ephemeral state | Load tests show equivalent behavior across at least two instances. |

The platform should use Neon as the durable system of record for ledger, entitlement, audit, and operational state, while a broker or managed real-time system handles fan-out rather than becoming the source of truth. Schema migration files remain immutable after production application; each new change should be forward-only, independently reviewed, and accompanied by a reversible application-level release strategy.

## Phase 4 — Cinema protection, rights, and entitlement expansion

Kryv Cinema already has the correct governance sequence: draft, rights evidence, approved asset manifest, readiness checks, publication state, and audit history. DRM should extend this workflow only after subscription and entitlement checks are stable. FastPix documents Widevine, PlayReady, and FairPlay support with CBCS encryption, but its current documentation states that DRM is applied to VOD content and requires DRM onboarding/configuration; Apple playback additionally needs a FairPlay certificate.[5] Accordingly, Cinema DRM should be treated as a rights-protection activation programme, not a simple player toggle.

| Stage | Required implementation | Exit condition |
|---|---|---|
| Rights and entitlement model | Define title, territory, availability window, entitlement type, profile eligibility, parental-rating rule, and audit record as required server checks before playback-token issuance | The public catalogue exposes only titles whose current rules permit discovery. |
| DRM onboarding sandbox | Use an isolated provider workspace, obtain the DRM configuration ID, complete certificate handling, and encrypt one non-sensitive test title | Chrome/Android, Safari/iOS, and Windows test matrices each validate the expected DRM route. |
| Token broker | Add a server endpoint that issues short-lived playback and DRM tokens only after entitlement and rights checks | The browser never receives a provider secret or a reusable long-lived entitlement credential. |
| Player abstraction | Extend the existing player behind an interface that supports standard HLS and protected VOD paths, with clear compatibility fallback states | A protected title either plays through its supported DRM path or reports a controlled compatibility message. |
| Operational rollout | Start with a small rights-cleared catalogue and collect token failures, license failures, device class, playback start rate, and support contacts | DRM is extended only after the initial title cohort meets reliability and support thresholds. |

## Phase 5 — Advertising activation without undermining the viewer experience

Advertising remains disabled by default. The goal is not merely to insert ad calls; it is to establish an accountable decision system with consent, suitability, frequency, delivery confirmation, and revenue reporting. Until those components are present, the platform should display no monetized ad behavior.

| Sequence | Platform responsibility | Server-authoritative requirement |
|---|---|---|
| Consent and policy | Capture jurisdiction-aware consent, age/profile restrictions, and advertising preferences in a versioned consent record | The client cannot assert consent; the server evaluates the current record. |
| Decision service | Return an explainable no-ad or eligible-ad decision for a surface, content context, viewer profile, and session | All eligibility, exclusions, and frequency caps are evaluated server-side. |
| Frequency and break policy | Enforce global and channel-level caps, spacing, content suitability, and creator eligibility | A creator cannot exceed caps by repeatedly calling a UI action. |
| Impression ledger | Record opportunity, selected campaign, start, quartiles where applicable, completion, error, and deduplication key | Revenue reporting is based on server-verified delivery events, not client claims. |
| Controlled launch | Start with a non-disruptive, consented surface and a small campaign cohort; monitor abandonment, playback errors, and cap violations | The owner can disable `ads_delivery` immediately and inspect the decision trail. |

## Delivery governance and decision gates

The roadmap should be managed through fortnightly evidence reviews rather than an unbounded feature queue. Each phase is allowed to start only when the previous phase’s operational acceptance signals are satisfied. This keeps the live and money paths stable while surface features expand.

| Gate | Evidence required to proceed | Owner decision |
|---|---|---|
| G1: Crypto controlled launch | Verified configured callback, one reconciled test invoice, invoice failure paths, kill-switch evidence | Enable or keep `crypto_commerce` disabled. |
| G2: Real-time beta | Replayable event contract, moderation-before-publish, delivery lag metric, bounded connection behavior | Expand from selected channels to broader live traffic. |
| G3: Discovery and clips | Rights-aware clip policy, audit trail, ranking explanation, no regression to live playback | Open viewer clip requests and personalised discovery rails. |
| G4: Production service posture | Paid service instance, monitoring, durable retries, deploy/rollback evidence | Treat live lifecycle and callbacks as production-critical. |
| G5: Cinema DRM | Rights checks, DRM onboarding proof, token broker, cross-device test matrix | Publish protected Cinema titles incrementally. |
| G6: Advertising | Consent, caps, impression ledger, revenue reconciliation, immediate kill switch | Enable `ads_delivery` for approved inventory only. |

## Final operating posture

Kryv should measure progress by trustworthy capability, not raw feature count. A channel becoming live must be provable from a signed lifecycle event; a crypto invoice must be traceable from intent through verified settlement; a viewer entitlement must be server-issued; a clip must have lawful provenance; a Cinema title must satisfy rights and device protection; and an ad event must reconcile to consent and delivery evidence. That is how the platform earns the reliability expected from a multi-surface live-entertainment product.

## References

[1]: https://plisio.net/documentation/endpoints/create-an-invoice "Plisio — Create an invoice"
[2]: https://plisio.net/documentation/endpoints/withdrawal-mass-withdrawal "Plisio — Withdrawal / Mass withdrawal"
[3]: https://fastpix.com/live-streaming "FastPix — Live streaming API"
[4]: https://fastpix.com/docs/webhooks/set-up-webhooks "FastPix — Set up webhooks"
[5]: https://fastpix.com/docs/video-security/set-up-drm-encryption "FastPix — Set up DRM encryption"
[6]: https://render.com/docs/free "Render — Deploy for Free"
[7]: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events "MDN — Using server-sent events"
[8]: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API "MDN — WebSocket API"

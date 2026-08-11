# Kryv Platform Expansion Audit

**Audit date:** August 11, 2026  
**Repository:** `DGC4/Kryv` on `main` at `3a92637`  
**Scope:** Creator onboarding and analytics, chat moderation and real-time delivery, native clips, live engagement, monetization, and retention/discovery.

## Executive finding

Kryv has a strong FastPix-based live foundation and a broad Neon schema, but the requested platform expansion is primarily an **API, workflow, constraint, and user-interface implementation effort** rather than a database-modeling exercise. The working channel-creation, FastPix stream provisioning, OBS preview, public HLS playback, viewer heartbeat, and live discovery ranking must remain isolated from this expansion.

## Current implementation baseline

| Area | Existing capability | Expansion gap | Implementation consequence |
|---|---|---|---|
| Creator onboarding | Owned channel creation, FastPix credential provisioning, OBS guide, five-second dashboard refresh | Creator settings action is not wired; analytics is a placeholder | Extend existing channel update and analytics endpoints without modifying FastPix provisioning behavior |
| Live chat | Authenticated write, public read, three-second polling | No moderator checks, bans, timeouts, slow mode, commands, deletion, or scalable realtime path | Build authorization and moderation server-side before changing the client transport |
| Clips | `clips` table already stores core publishing metadata | No source-media linkage, FastPix clipping request, processing state, routes, player, or sharing surface | Add a separate clip asset/workflow and use FastPix asynchronous transforms |
| Engagement | Tables model points, rewards, polls, predictions, raids, hosts, goals, notifications, and schedules | No API contracts or creator/viewer UI | Implement a minimum safe engagement set first, with transactions and idempotency protections |
| Monetization | Placeholder subscription/tip records and marketing-only plan cards | No payment provider, receipt/ledger fields, connected accounts, checkout, webhook intake, refunds, or payout workflows | Payment activation is gated on a verified Stripe account, prices, legal/policy decisions, and test credentials |
| Discovery and retention | Live viewer ranking, category browse, follow storage, basic VOD query filters | Search UI is incomplete; no followed-live row or notification preference UI | Extend discovery APIs after notifications and clips have durable states |

## Infrastructure and security observations

The API is an Express service with Helmet, CORS, JWT authentication, rate limits, and FastPix raw-body webhook verification. It has no WebSocket or server-sent-event transport today. Its current CSP permits FastPix media and API connections, but would need review if browser connections to a new realtime service or a payment provider are introduced.

FastPix is already correctly used for RTMPS ingest, HLS playback, viewer counts, DVR, and lifecycle webhooks. Its current documentation confirms that live recordings can later be clipped once they have an on-demand FastPix media ID; clips are distinct asynchronous on-demand assets with their own media and playback IDs. FastPix recommends using its media-ready webhook rather than frequent polling to know when a clip becomes playable. [1]

## Neon audit

The three recent production indexes are present: `channels_live_viewers_idx`, `channels_live_category_viewers_idx`, and `videos_cinema_catalog_idx`. The current production data has no duplicate `(channel_id, user_id)` channel-point rows, duplicate poll votes, duplicate prediction entries, or duplicate active subscription pairs.

The expansion tables currently have only primary-key indexes in the inspected areas. Before traffic is directed to the new features, the migration should add feature-specific indexes and partial unique constraints for the database-enforced invariants below.

| Required invariant | Current state | Recommended database enforcement |
|---|---|---|
| One channel-points balance per viewer/channel | Not enforced | Unique `(channel_id, user_id)` |
| One vote per viewer/poll | Not enforced | Unique `(poll_id, user_id)` |
| One prediction entry per viewer/prediction | Not enforced | Unique `(prediction_id, user_id)` |
| One active subscription per viewer/channel | Not enforced | Partial unique index on `(user_id, channel_id)` where `status = 'active'` |
| Fast chat pagination by channel and timestamp | No supporting index observed | Index `(channel_id, created_at DESC, id DESC)` |
| Moderation lookup on every message | No supporting indexes observed | Index active bans/timeouts by `(channel_id, user_id, expires_at)` |
| Clip browse and lookup | No supporting indexes observed | Index channel/publication/time and FastPix clip asset identity |
| Payment event idempotency | No payment-event record exists | New immutable payment-event table with unique provider event ID |

## External-integration readiness

FastPix is currently used from server environment credentials rather than a task connector. The task configuration contains disabled Stripe and Stripe API integrations, and no payment secret or webhook signing secret was provided by the user. This blocks live payment activation, not the design, schema preparation, checkout interfaces, or webhook endpoint implementation.

Stripe’s official platform documentation describes connected accounts, recurring subscription routing, platform fees, payout responsibilities, and webhook-driven entitlement changes. It also requires server-side event signature verification. [2] [3]

## Key architectural decisions to finalize in the roadmap

1. Choose a scaled chat event delivery model: an external managed real-time provider, a Render-compatible server-sent-events approach, or a WebSocket service with external pub/sub. The existing polling API can remain as a temporary client fallback but should not be the permanent high-concurrency transport.
2. Make clip publishing depend on a completed FastPix on-demand recording and its `mediaId`. Current live session state must be extended to save the linked VOD asset.
3. Treat channel points and prediction balances as application-controlled virtual values; do not make them redeemable for cash or transferable value in the initial release.
4. Select Stripe Connect account type, the platform fee/revenue share, supported countries/currencies, refund policy, subscription price(s), and payout cadence before payment activation.
5. Put payment entitlement changes behind signed, idempotent Stripe webhook handling. Browser redirects or client confirmation alone must never activate subscriptions or credit tips.

## Sources

[1]: https://fastpix.com/docs/video-on-demand/clip-and-trim-videos.md "FastPix — Clip and trim videos"
[2]: https://docs.stripe.com/connect/subscriptions "Stripe — Create subscriptions with Stripe Billing"
[3]: https://docs.stripe.com/webhooks "Stripe — Receive Stripe events in your webhook endpoint"

## FastPix clip and live-recording implementation findings

FastPix documents native clip creation as an asynchronous `POST https://api.fastpix.com/v1/on-demand` request with a source URL in the form `fp_mediaId://<source media ID>`, plus `startTime` and `endTime` in seconds. The response contains a distinct clip media ID and playback ID; FastPix then sends a media-ready event when the clip is playable. Its HLS URL is `https://stream.fastpix.com/<playbackId>.m3u8`. [4]

FastPix live-stream update payloads can include `data.mediaIds`, described as the VOD media assets generated from a live recording. Kryv should use these IDs to create or link internal VOD records and populate the relevant stream session’s VOD reference. [5]

[4]: https://fastpix.com/docs/video-on-demand/clip-and-trim-videos.md "FastPix — Clip and trim videos"
[5]: https://fastpix.com/docs/webhooks/live-events.md "FastPix — Live stream events"

## Stripe Connect monetization foundation findings

Kryv’s monetization design uses Stripe Connect hosted onboarding so that Stripe, rather than Kryv, collects and verifies creator identity, business, and payout details. The application should persist only opaque provider account identifiers and capability state such as `charges_enabled`, `payouts_enabled`, `details_submitted`, and outstanding requirement names. Hosted account-link URLs are short-lived, single-use, and must only be presented inside the authenticated creator session. [6]

Stripe webhook handlers must verify the signature against the raw request body, be idempotent by provider event ID, and avoid storing raw event payloads that may contain unnecessary personal data. Kryv records a minimal event ledger to support retries and auditability. [7]

[6]: https://docs.stripe.com/connect/express-accounts "Stripe — Using Express connected accounts"
[7]: https://docs.stripe.com/webhooks "Stripe — Receive Stripe events in your webhook endpoint"

## Rendered mobile/desktop audit — August 11, 2026

- The API-connected local Watch route renders successfully after the initial load delay. Its empty state is centered and touch-safe, but the standard desktop header shows all primary navigation and both global/local search surfaces at wide dimensions.
- The Watch page requires a refined mobile-specific discovery layout: a more intentional hero/search hierarchy, stronger empty-state call to action, and a dedicated compact-header/mobile-search pattern rather than relying on desktop controls being hidden.
- Route restoration must be verified in the browser against `/privacy` and `/terms` after the scroll helper is corrected and compiled.

The rebuilt Watch route was rendered and visually validated in the API-connected preview. It now has a distinct library hero, deliberate search hierarchy, horizontal touch-safe category controls, responsive video grid geometry, and an editorial empty state that gives the product a launch-ready VOD identity rather than a generic template appearance. The route has no visible overlap, dead whitespace within the content hierarchy, or cramped calls to action at the inspected viewport.

Both `/privacy` and `/terms` were rendered directly after route navigation. Each route opened at the true top of the document (`Pixels above viewport: 0`) and presented a consistent, high-contrast legal hierarchy without template disclaimers or mid-page entry behavior. The privacy notice visibly reflects FastPix, Neon, Stripe Connect, moderation, engagement, notification, and analytics handling; the terms reflect VOD, clips, creator verification, monetization, moderation, and guest access mechanics.

A true 390×844 browser screenshot of `/watch` confirms the mobile hierarchy holds: the compact header remains within the viewport, primary navigation converts to touch-friendly icons without collision, the Kryv Watch hero stacks correctly, the search affordance remains full-width and readable, and the category filter stays accessible. The screenshot shows no clipping, horizontal overflow, or overlapping controls at phone width.

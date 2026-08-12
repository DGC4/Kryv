# Platform roadmap source notes

## FastPix

- [Set up DRM encryption](https://fastpix.com/docs/video-security/set-up-drm-encryption): FastPix describes CBCS MPEG Common Encryption and lists Widevine, PlayReady, and FairPlay. Its current documentation says DRM can only be applied to VOD content, recommends an isolated testing workspace during beta/onboarding, requires a DRM configuration ID, and requires a FairPlay certificate for Apple playback. Kryv should therefore treat Cinema DRM as a protected VOD-only activation programme, not a live-stream switch.
- [Live streaming API](https://fastpix.com/live-streaming): FastPix documents RTMP/RTMPS/SRT ingest, low-latency HLS delivery, authenticated ingest, backup ingest, live-to-VOD archiving, mid-event clipping, DVR, signed playback, stream health, and lifecycle webhooks. Kryv can retain the current external provider lifecycle as the server authority while incrementally adding replay, authorised clips, QoE reporting, and resilience safeguards.
- [Set up webhooks](https://fastpix.com/docs/webhooks/set-up-webhooks): FastPix says the `FastPix-Signature` header is a Base64 HMAC-SHA256 of the unmodified raw payload. Kryv already verifies signed payloads and rejects missing/invalid signatures, which is the appropriate basis for live-state authority.

## Plisio

- [Create an invoice](https://plisio.net/documentation/endpoints/create-an-invoice) and [withdrawal / mass withdrawal](https://plisio.net/documentation/endpoints/withdrawal-mass-withdrawal) remain the provider references for controlled invoices, verified callback settlement, and future owner-reviewed crypto payouts. See `crypto_provider_reference.md` for the implementation-specific summary.

## Production validation performed on 2026-08-12 EDT

- `GET /api/healthz` returned `200` with `{"status":"ok","database":"ok","fastpix":"ok"}`.
- `POST /api/webhooks/stripe` returned `404`.
- Disabled `POST /api/channels/1/subscribe` and `POST /api/channels/1/tip` returned `503`; no invoice was created.
- `POST /api/webhooks/plisio?json=true` returned configuration-safe `503`.
- Unsigned `POST /api/webhooks/fastpix` returned `400`; the webhook probe returned `200`.

These are non-destructive checks; no production flag was enabled and no money movement, payout, or live state was changed.

## Render resilience

- [Deploy for Free](https://render.com/docs/free): Render states that Free web services are for preview/testing rather than production, spin down after 15 minutes of inactivity, take about one minute to wake on the next HTTP or WebSocket request, can restart, cannot scale beyond one instance, and have no persistent disks. Render documents changing the **service instance type** to a paid plan as the supported way to remove Free-instance limitations; a workspace-plan upgrade alone does not do so.
- [Your First Render Deploy](https://render.com/docs/your-first-deploy): Render documents automatic Git-branch deployment, service logs, paid operational controls, and separate background-worker/cron-job service types. Kryv’s roadmap therefore treats a paid API instance plus monitoring and an explicit background-processing path as the production solution, rather than an unsupported keep-alive loop.

## Real-time transport

- [Using server-sent events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events): SSE is a one-way server-to-client connection. It is viable for an incremental chat-feed migration while the existing REST write endpoint remains authoritative, but the browser’s ordinary HTTP/1.1 connection ceiling makes it unsuitable as the long-term fan-out layer unless the deployment path supports HTTP/2 and connection management.
- [WebSocket API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API): WebSockets provide two-way interactive communication without polling. The standard `WebSocket` interface lacks application-level backpressure, so Kryv’s production chat design must include bounded outbound queues, slow-consumer disconnection/replay, moderation-before-publish, and a shared pub/sub fabric before multiple API instances are enabled.

## Viewer-surface verification

The deployed public home rendered normally in My Browser with no blank-screen failure. A direct visit to `/live/1` displayed the expected not-found state because the public viewer route resolves a **slug** (`/live/fano`), not a numeric ID. This exposed an invoice-return defect: the checkout API had constructed return paths from the numeric channel ID. The source has been corrected to return to the canonical channel slug before the next deployment; no invoice was opened during verification.

A direct visit to the canonical `/live/fano` route rendered the channel viewer page successfully and exposed the **Follow** and **Support** controls in the rendered page content. The channel was offline during the check, and no support action, invoice creation, chat submission, or other state-changing action was performed.

After the desktop-scroll repair deployed, the primary channel content region exposed its own scrollbar and accepted a container scroll rather than clipping the page outright. The browser’s rendered content continued to include the channel metadata, **Follow**, **Support**, and engagement elements; no transaction or other state-changing control was invoked.

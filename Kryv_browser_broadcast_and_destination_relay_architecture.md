# Kryv Browser Broadcast Studio and Destination Relay Architecture

**Status:** Design approved for staged implementation; not yet enabled in production.

## Decision

Kryv should keep **FastPix as the primary managed media system** for live ingest, low-latency HLS delivery, recording, VOD, and external RTMP destination fan-out. Kryv should **not** begin by operating its own RTMP/media-transcoding server. FastPix already provides hosted RTMPS/SRT ingest, managed delivery, and documented simulcast targets, whereas a self-hosted origin would introduce persistent media infrastructure, operational risk, and unnecessary parallel media state.[1][2]

A normal browser can request a user’s camera and microphone but does not natively publish an RTMP/RTMPS broadcast. Therefore, the future **Go Live from Kryv** button requires a dedicated WebRTC/WHIP publishing layer that accepts the browser stream and relays one authenticated broadcast to the existing FastPix RTMPS ingest. Kryv can keep the browser experience first-party while using a narrowly scoped, production-grade media gateway for the protocol bridge.

| Layer | Responsibility | Security boundary |
|---|---|---|
| Creator browser | Explicit camera/microphone permission, local preview, scene/filter controls, WebRTC uplink | No FastPix secret or external destination credential is present in browser code |
| Kryv API | Session issuance, channel ownership checks, broadcast state, destination authorization, audit trail | Server decides eligibility, live state, and destination activation |
| Publishing gateway | Authenticated WebRTC/WHIP ingest, H.264/AAC encoding, one RTMPS push to FastPix | Short-lived publish token; isolated per creator session; no public control plane |
| FastPix | Managed ingest, delivery, live-to-VOD, and supported simulcast fan-out | Hosted stream key stays server-controlled and is never public-facing |
| External destination | Creator’s authorized YouTube/Meta destination | Creator OAuth/eligibility and encrypted credentials are mandatory |

## Product behavior

The Creator Studio will receive a separate **Browser Studio** flow. It will first present a device-permission screen. Nothing can request camera or microphone access without the creator pressing the consent action. The local preview will support a small set of performant, clearly labeled effects—such as crop, mirror, brightness, contrast, background blur where supported, and microphone selection—without implying hidden recording or background capture.

After the creator starts a broadcast, Kryv’s server creates a short-lived publishing session for that creator’s channel and the gateway forwards the resulting encoded stream to the channel’s existing managed ingest. FastPix webhooks remain the only authority for the public `isLive` state. The Studio preview and viewer channel both continue to use the same provider playback identifier and current live-edge player behavior.

## Destination relay policy

A destination belongs to the **creator who authorizes it**. Kryv must not accept an arbitrary RTMP URL or plain-text stream key from a browser form. The first supported destination should be **YouTube Live** through creator-initiated Google OAuth. The server will use the authorized creator account to create/bind the YouTube `liveBroadcast` and `liveStream` resources, then keep the returned ingest information encrypted. YouTube states that these requests must be authorized by the Google Account that owns the broadcasting channel.[3]

FastPix documents managed simulcast targets for YouTube, Facebook Live, and Twitch, and documents the lifecycle events for a target.[4] Each destination should be assembled before the FastPix stream becomes active because the current provider documentation says targets can only be added while its live object is idle.[4]

**Instagram Live is not a production commitment in this phase.** Meta’s documented Live Video API covers Facebook broadcasting and requires App Review, permissions, eligibility, and an app-produced RTMPS stream.[5] FastPix’s explicit supported-target list does not name Instagram. If Instagram later qualifies for Kryv, it must be implemented only after the creator is confirmed eligible for Meta Live Producer/RTMP, the current Meta permission/approval path is validated, and an authorized creator-specific connection exists. Kryv will never collect or persist an Instagram key in ordinary client storage.

| Destination | Initial availability | Credential model | Gate before enabling |
|---|---|---|---|
| Kryv Live | Existing FastPix ingress | Server-held managed stream authority | Existing channel ownership and provider status webhooks |
| YouTube Live | First relay candidate | Creator OAuth; encrypted server-side refresh token and ephemeral ingest details | Google OAuth review, creator channel authorization, end-to-end private broadcast test |
| Facebook Live | Later candidate | Creator OAuth; server-side encrypted destination state | Meta App Review, required permissions, creator/page eligibility, private test |
| Instagram Live | Deferred | No implementation until official creator eligibility and delivery path are validated | Meta Live Producer/RTMP validation, authorization, capability test, legal/policy review |

## Required data and security controls

The future implementation will create dedicated tables for `creator_broadcast_destinations`, `broadcast_sessions`, and `broadcast_destination_events`. Destination secrets use a dedicated **`STREAM_DESTINATION_ENCRYPTION_KEY`** with AES-256-GCM and key-version metadata. This is intentionally separate from the payout encryption key. API responses return only masked destination identifiers and status; no raw stream key, refresh token, provider key, camera data, or private media URL is returned to the creator browser.

Every session must have a server-issued expiry, exact channel/user binding, one-time gateway token, rate limit, and audit event. A creator can remove a destination at any time; removal destroys the encrypted credential material and disables the provider target. The gateway must reject publishing attempts without an active session, must not expose an administration endpoint to the public internet, and must supply its own health metrics and alerting.

No client may determine a channel’s `isLive` value, broadcast entitlement, moderation outcome, relay success, or destination delivery status. FastPix webhook events and gateway session events establish authoritative state. Device permissions are local, user initiated, and revocable. Kryv will not capture screens, camera frames, microphone content, credentials, or off-platform behavior for observability.

## Delivery sequence

| Stage | Deliverable | Activation criterion |
|---|---|---|
| 1 | Creator device preview, permission UX, local filters, no transmission | Browser permission denial/revocation and mobile compatibility tested |
| 2 | Persistent WebRTC/WHIP gateway with authenticated session issuance and FastPix RTMPS egress | Load, reconnect, token-expiry, and failure-isolation testing completed |
| 3 | Creator Broadcast Studio controls, server-held session state, provider webhook reconciliation | Private end-to-end channel test verifies current live playback and automatic recovery |
| 4 | YouTube OAuth and FastPix target wiring | OAuth review, encrypted credential test, and private broadcast lifecycle test completed |
| 5 | Optional Meta destination evaluation | Meta approval/eligibility and legal/policy gates completed; no client-held stream keys |

> **Activation rule:** No browser publishing gateway, destination relay, or external posting function is enabled solely because its user interface exists. Each stage remains disabled behind a server-controlled feature flag until the preceding reliability, security, and provider-approval gates pass.

## References

[1] [FastPix Live Streaming Quickstart](https://fastpix.com/docs/live-streaming/quickstart)

[2] [FastPix Live Streaming API](https://fastpix.com/live-streaming)

[3] [Google: YouTube Live Streaming API Overview](https://developers.google.com/youtube/v3/live/getting-started)

[4] [FastPix: Simulcast to Multiple Platforms](https://fastpix.com/docs/live-streaming/simulcast-to-multiple-platforms)

[5] [Meta: Live Video API](https://developers.facebook.com/documentation/live-video-api)

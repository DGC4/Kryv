# Native Kryv Creator Studio Integration

The creator studio will live inside the existing **`artifacts/blyze`** React application at `/dashboard/live`. It will remain protected by the application’s Clerk route guard and will use the established API client rather than the separate Manus OAuth dashboard that was previously copied into this branch.

## Design alignment

The studio will preserve the current Kryv shell, including the shared `Layout`, animated canvas background, rotating `data-theme` neon palette, `Space Grotesk` and `Outfit` typography, `KryvLogo`, Golden D owner badge, role tooltips, and Header theme-cycle control. No new independent visual system will be introduced.

## Live-streaming contract

Kryv already uses Mux for actual RTMP ingest and HLS playback. A creator owns one reusable Mux live-stream configuration. The studio will create that configuration once, return the RTMP URL and secret key only to the authenticated owner, and reset the existing Mux stream key when the creator regenerates it. The backend will no longer rely on a client-side “go live” toggle: Mux webhook events remain the authority for live/offline state.

## Security and production readiness

The Mux webhook route will fail closed when its signing secret is absent, and stream keys will not be persisted as plaintext in the Kryv database. The deployment configuration will continue to require `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and `MUX_WEBHOOK_SECRET`; without all three, the UI will explain that ingest has not been activated instead of claiming that streaming is live.

## Data honesty

The studio will consume the existing channel, category, follower, live-state, playback, and chat data. It will not fabricate viewer, revenue, payout, or analytics values. Those capabilities will be shown only when an authenticated provider or real backend source is connected.

## Provider references

Mux documents that a reusable live-stream configuration should be associated with each creator and that a compromised or lost key should be reset rather than treated as public data.[1] Mux also documents that disabling a stream immediately stops active ingest and that webhook signatures must be verified with the endpoint-specific signing secret.[2] [3]

[1]: https://www.mux.com/docs/guides/manage-stream-keys "Mux: Manage stream keys"
[2]: https://www.mux.com/docs/api-reference/video/live-streams/disable-live-stream "Mux: Disable a live stream"
[3]: https://www.mux.com/docs/core/verify-webhook-signatures "Mux: Verify webhook signatures"

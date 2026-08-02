# Kryv Live Streaming Runbook

Kryv Live uses the real Mux Video live-stream API for RTMP ingest and HLS playback. The creator studio at `/dashboard/live` creates a Mux live-stream configuration for the authenticated channel, displays the generated key only in the active creator session, and relies on signed Mux webhook events to set the public channel’s live state.

> The application now fails closed when Mux credentials or the webhook signing secret are absent. This is intentional: it prevents unverified events from marking a channel live and prevents the interface from implying that broadcasting is active when the provider is not configured.

| Requirement | Where to configure it | Purpose |
|---|---|---|
| `MUX_TOKEN_ID` | Render service environment | Server-side Mux API authentication. |
| `MUX_TOKEN_SECRET` | Render service environment | Server-side Mux API authentication. |
| `MUX_WEBHOOK_SECRET` | Render service environment | Verifies Mux event signatures before Kryv changes live state. |
| Mux webhook URL | Mux dashboard | `https://<kryv-domain>/api/webhooks/mux` receives signed live-state events. |
| `DATABASE_URL` | Render service environment | Existing Kryv channel, stream configuration ID, and public playback ID persistence. |

## One-time production setup

First, create a Mux API token with the required Video permissions and place the token ID and secret in the Render service as `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`. Create a Mux webhook for the deployed Kryv URL, copy its endpoint-specific signing secret into `MUX_WEBHOOK_SECRET`, and deploy the branch. The webhook is mandatory because Mux events, not a browser button, are Kryv’s authority for `isLive` and `isOffline` state.[1]

If the database was used by an earlier revision that persisted the Mux stream key, run the following once from a secured shell before enabling production ingest. The command only nulls the legacy database column; it does not delete the creator’s Mux configuration or invalidate a current Mux key.

```bash
DATABASE_URL="<production database URL>" pnpm --filter @workspace/db run clear:legacy-stream-keys
```

## Creator acceptance flow

| Step | Expected result |
|---|---|
| Sign in and open `/dashboard/live` | The native Kryv Creator Studio loads through the existing Clerk protected route. |
| Create or open a channel | The dashboard reads the real current-user channel from `/api/me`. |
| Set the stream title and category | Values persist through the existing authenticated channel update endpoint. |
| Select **Generate stream key** | The backend creates a Mux configuration once or resets the existing Mux key; the secret appears only for this authenticated session. |
| Paste credentials into OBS/Streamlabs/XSplit | Use the displayed RTMP server and stream key with a Custom RTMP service. |
| Start broadcasting | Mux emits a signed `video.live_stream.active` event, and Kryv marks the public channel live. |
| Stop broadcasting | Mux emits an idle or disconnected event, and Kryv marks the channel offline. |

To rotate a compromised key, select **Regenerate key** in the studio and confirm the modal. Mux immediately invalidates the previous key and creates a new one.[2]

## Validation checklist

Use a short private test broadcast before announcing the platform. Confirm the signed webhook reaches `POST /api/webhooks/mux`, the channel’s public page begins playing its Mux HLS stream, and the creator dashboard changes to **Live now** only after the webhook arrives. Confirm that copying a public channel card URL using `kryv.tv/live/<slug>` resolves the correct channel; Kryv now resolves both numeric channel IDs and channel slugs.

## References

[1]: https://www.mux.com/docs/core/verify-webhook-signatures "Mux: Verify webhook signatures"
[2]: https://www.mux.com/docs/api-reference/video/live-streams/reset-stream-key "Mux: Reset a live stream key"

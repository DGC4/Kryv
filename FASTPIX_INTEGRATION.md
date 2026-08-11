# FastPix Integration

## Runtime Configuration

Kryv uses FastPix for live-stream ingest, live HLS playback, viewer-count measurement, and video delivery. Configure the server environment with the FastPix access token, secret key, and webhook signing secret. Do not commit credentials, stream keys, or any other secrets to this repository.

## Live-Streaming Flow

1. The creator dashboard provisions a FastPix live stream and securely stores its stream ID, stream key, and playback identifier on the channel record.
2. The creator enters the supplied RTMPS server URL and stream key in OBS or another compatible encoder.
3. FastPix sends lifecycle webhooks. Kryv maps `data.streamId` to the channel, publishes the channel only when FastPix reports the `video.live_stream.active` event, and marks it offline on disconnect or idle events.
4. The creator dashboard refreshes status for the OBS preview. Public live, category, and discovery pages refresh their listings and rank active broadcasts by FastPix’s near-real-time viewer count.
5. Guests may watch public live broadcasts and read chat; an account is required to send chat messages or use creator controls.

## Playback

Live and on-demand HLS playback uses the FastPix playback identifier:

```text
https://stream.fastpix.com/{playbackId}.m3u8
```

The frontend uses `hls.js` with low-latency mode where supported by the browser. The live-stream provisioning request enables DVR mode, uses a 60-second reconnect window, and stores Kryv channel metadata with the FastPix stream to support reliable operational tracing.

## Operational Notes

- Use the dashboard’s **Rotate Key** action immediately if a stream key may have been exposed.
- Configure the FastPix webhook target as `/api/webhooks/fastpix` on the deployed Kryv API, with the matching signing secret.
- Viewer counts are approximate and near-real-time; Kryv applies a short server-side cache to avoid excessive upstream count requests while keeping rankings current.
- Run the workspace build before deploying changes: `pnpm run typecheck && pnpm --filter @workspace/blyze run build && pnpm --filter @workspace/api-server run build`.

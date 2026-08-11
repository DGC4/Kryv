# FastPix Live Synchronization Verification Notes

FastPix’s official live-event documentation describes `video.live_stream.connected` as the encoder-handshake event, `video.live_stream.active` as the point when viewers can watch, `video.live_stream.disconnected` as a temporary interruption, and `video.live_stream.idle` as the definitive post-reconnect-window end state. `video.live_stream.recording` is emitted when recording begins if recording is enabled. A reconnect window defaults to 60 seconds, and FastPix recommends waiting for the idle event before treating an interrupted stream as conclusively ended. [1] [2]

Kryv must use these events privately to update channel playback identity, `isLive`, the current stream session, and viewer discovery. The public interface should refer only to a Kryv broadcast or live channel, never to the provider or the creator’s chosen encoder. FastPix advises verifying the raw request against the `FastPix-Signature` Base64-encoded HMAC-SHA256 signature and signing key before accepting a webhook. [3]

FastPix’s viewer-count endpoint returns `data.views`, a near-real-time approximate count of clients actively watching a stream. Kryv uses this value with a short server-side cache to update `channels.viewerCount`; its live and category discovery responses order channels by the persisted count. The installed FastPix Node SDK v2.0.9 exposes this endpoint as `manageLiveStream.getViewerCount({ streamId })`, matching the implementation. [4]

New Kryv live-stream provision requests explicitly enable recording and DVR mode. This preserves the existing path from a concluded live session to the recorded media asset, VOD record, and clip workflow. FastPix documents `active`, `idle`, `preparing`, and `disabled` as live-stream statuses; Kryv treats only `active` as publicly live and waits for `idle` or `disabled` before conclusively ending a session. [5]

## References

[1]: https://fastpix.com/docs/webhooks/live-events "FastPix: Live stream events"
[2]: https://fastpix.com/docs/live-streaming/handle-stream-disconnects "FastPix: Handle stream disconnects"
[3]: https://fastpix.com/docs/webhooks/set-up-webhooks "FastPix: Set up webhooks"
[4]: https://fastpix.com/docs/live-stream-api/manage-live-stream/get-live-stream-viewer-count-by-id "FastPix: Get stream views by ID"
[5]: https://fastpix.com/docs/live-streaming/create-and-manage-live-streams "FastPix: Create and manage live streams"


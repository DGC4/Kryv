# Kryv Live Playback and Broadcast Follow-Up Research

## FastPix playback behavior

FastPix documents LL-HLS as a low-latency delivery mode that typically produces roughly 8–12 seconds of end-to-end delay, dependent on encoder, network, player buffering, and viewer environment. Its current managed live-stream creation example shows `enableDvrMode: false` for ordinary live playback, while DVR is intended for a deliberate pause/rewind/resume experience. Kryv currently enables DVR for every new channel stream, so the player must explicitly join at the live synchronization position and offer a return-to-live action rather than inheriting a stale time-shifted point.

FastPix also documents automatic live-to-VOD conversion, so the same provider can remain Kryv’s media system for live, replays, Cinema asset delivery, and clipping. No Kryv-operated ingest server is required for the existing OBS/RTMPS pathway.

## Simulcasting

FastPix’s documented simulcast API can fan a single FastPix ingest to configured RTMP/RTMPS third-party destinations. Its current documentation explicitly lists YouTube, Facebook Live, and Twitch; targets can be configured before a broadcast, and the detailed reference states target changes are allowed only while the FastPix stream is idle. It also defines signed simulcast lifecycle webhooks. The documented official target list does **not** name Instagram Live, so Instagram must stay outside the first production launch until its current authorized integration and destination requirements are verified with Meta.

## Design implications

Kryv should keep FastPix as the hosted ingestion and distribution layer instead of attempting to operate a self-hosted streaming server. The product can add a browser camera/microphone broadcast flow that encodes to the existing FastPix ingest only after a browser publishing/encoder strategy is selected and tested. External destination stream keys must be encrypted server-side, never returned to the browser, attached only by the creator who controls the destination, and relayed through FastPix once the primary stream is provisioned.

## Sources

1. FastPix, [Live streaming quickstart](https://fastpix.com/docs/live-streaming/quickstart).
2. FastPix, [Live streaming API](https://fastpix.com/live-streaming).
3. FastPix, [Simulcast to multiple platforms](https://fastpix.com/docs/live-streaming/simulcast-to-multiple-platforms).
4. FastPix, [Live event](https://fastpix.com/solutions/live-event).

## Authorized external destinations

YouTube’s official Live Streaming API documentation states that a live broadcast is managed as a `liveBroadcast` bound to a `liveStream`, and that Data API requests must be authorized by the Google Account that owns the broadcasting YouTube channel. The API supports creating, updating, binding, transitioning, and deleting these resources. Kryv must therefore use creator-initiated OAuth consent, store only encrypted server-side refresh credentials, and let the authenticated creator select the YouTube channel and broadcast metadata. A platform owner account must never substitute for a creator’s destination authorization.

The current FastPix official simulcast documentation explicitly documents YouTube, Facebook Live, and Twitch RTMP targets, but not Instagram. Instagram Live must be treated as a separate, later capability: it can only be offered after validation of the creator’s eligibility and Meta’s current authorized Live Producer/RTMP requirements. No hard-coded Instagram endpoint or key collection should be shipped.

5. Google for Developers, [YouTube Live Streaming API Overview](https://developers.google.com/youtube/v3/live/getting-started).
6. Meta, [IG User Live Media](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/live_media).
7. Meta, [Live Video API](https://developers.facebook.com/documentation/live-video-api).
8. Instagram, [Instagram Live Producer](https://about.instagram.com/blog/tips-and-tricks/instagram-live-producer).

Meta’s current Live Video API documentation is for Facebook live broadcasting and crossposting; it requires App Review, platform permissions, and an app-produced RTMPS stream. It also documents account eligibility requirements for Facebook live. This confirms that Kryv must never treat a generic Instagram connector as permission to relay live video. Any Meta destination must be creator-authorized, platform-eligible, approved for the necessary permissions, and configured after the creator’s explicit action.

9. Meta for Developers, [Live Video API](https://developers.facebook.com/documentation/live-video-api).

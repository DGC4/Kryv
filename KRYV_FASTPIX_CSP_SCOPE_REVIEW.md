# Kryv FastPix CSP Scope Review

**Decision:** Retain `https://*.fastpix.com` in `media-src` and `connect-src` for now. This is a **deliberate compatibility boundary**, not a relaxation of the rest of Kryv’s CSP.

Kryv already pins its primary playback and API origins to `https://stream.fastpix.com` and `https://api.fastpix.com`. FastPix documentation shows HLS playback using `stream.fastpix.com` directly, while its live delivery documentation describes a multi-CDN delivery mesh and per-viewer edge routing. The provider does not publish a durable finite list of every rendition, signed-playback, or edge-delivery hostname that Kryv can safely hard-code. Narrowing the current FastPix-only wildcard without an explicit provider hostname contract could break HLS manifest, segment, or playback analytics retrieval for some viewers. [1] [2]

| CSP area            | Current boundary                                                       | Review finding                                                                                      | Decision                          |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------- |
| `media-src`         | Self, `stream.fastpix.com`, FastPix-domain wildcard, blob URLs         | HLS playback begins at `stream.fastpix.com`; delivery may traverse provider-managed infrastructure. | Retain the FastPix-only wildcard. |
| `connect-src`       | Self, `stream.fastpix.com`, `api.fastpix.com`, FastPix-domain wildcard | HLS.js retrieves manifests and segments through browser fetch; provider delivery is multi-CDN.      | Retain the FastPix-only wildcard. |
| Other third parties | Not added by this review                                               | No unrelated host was required for Kryv player operation.                                           | No change.                        |

> The wildcard is limited to the provider-controlled `fastpix.com` domain family. It does **not** permit arbitrary HTTPS origins and does not alter Kryv’s strict `default-src`, `script-src`, `frame-src`, or `object-src` boundaries.

## Reconsideration Gate

Replace the wildcard only after FastPix provides a stable documented hostname allowlist that covers signed HLS manifests, all rendition segments, analytics endpoints used by Kryv, and regional/CDN routing behavior. Before production tightening, validate playback on Chromium, Safari/native HLS, mobile web, and live plus VOD streams. A CSP Report-Only observation period should precede enforcement.

## References

[1]: https://fastpix.com/docs/video-data/monitors/hlsjs "FastPix — Monitor HLS.js"
[2]: https://fastpix.com/live-streaming "FastPix — Live streaming API"

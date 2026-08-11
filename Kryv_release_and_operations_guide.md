# Kryv Release and Operations Guide

## Release status

The production update is published to GitHub `main` in commit **`705f606`** (`feat: launch governed cinema publishing desk`). The backend and frontend production builds completed successfully. The production Cinema API returns the new governed-catalog response shape, and the public Cinema page and authenticated owner Cinema control room both rendered correctly in direct production checks.

The previously reported **Kryv Watch** black screen was also repaired and verified in production. The fault was missing page-runtime imports; the repaired route now reaches its normal Watch-library state rather than failing before render.

| Surface | Verified outcome |
|---|---|
| **Kryv Watch** | The Watch route renders instead of presenting a black screen. |
| **Live activation** | The production FastPix webhook exists, its signing secret is stored as a protected backend variable, unsigned events are rejected, and a signed non-matching verification event is accepted without changing channel state. |
| **Creator Studio** | Location is no longer a go-live requirement. Studio uses the channel live state and playback identity refreshed by the secured event lifecycle. |
| **Public Live discovery** | A verified `active` event publishes the channel; Live and category discovery use the channel state and server-cached viewer metrics. |
| **Cinema** | Public viewer shelves now consume only **published**, **rights-cleared**, **feature-ready** Cinema records, not generic uploads. |
| **Owner Console** | The Cinema tab now provides a controlled publishing desk with title drafts, asset manifests, rights windows, readiness gates, state transitions, and audit history. |

## Your OBS-to-Kryv go-live checklist

Your production callback is now configured at `https://kryv-backend.onrender.com/api/webhooks/fastpix`. The signing secret is kept only in protected service configuration; it is not placed in source control or displayed to viewers.

1. Open **Creator Studio → Live** and ensure the channel has been created. Copy the private RTMPS ingest address and stream key shown there.
2. In OBS, open **Settings → Stream**, select a custom streaming server, paste the private RTMPS server address, and paste the private stream key. Do not place the key in a public scene, screenshot, or chat.
3. Start streaming in OBS. When the encoder connects and the provider recognizes the stream as active, the signed event reaches Kryv.
4. Kryv caches the playback identity during connection/preparation, marks the channel live on the confirmed active event, creates one idempotent stream session, and preserves the session during a short reconnect window. The Studio refresh cycle is five seconds and public Live discovery refreshes every ten seconds.
5. Verify the Creator Studio preview first, then open the public Live home or the selected category. The channel should appear once active, and the ranking will use synchronized viewer metrics.
6. End the OBS broadcast and wait through the reconnect window. Kryv only ends the public session on a confirmed terminal lifecycle state rather than reacting to a brief encoder/network interruption.

> **The one remaining real-world acceptance test is yours to run:** start an OBS broadcast from your actual channel, then confirm the Studio preview and public listing appear. The secure event receiver, signature enforcement, and application state path are already active; this last test proves the physical encoder configuration and your selected channel credentials.

FastPix documents RTMPS ingest, the live-status transition to `active`, playback identifiers, the reconnect window, recording, DVR, and the related webhook lifecycle. [1]

## Live capability roadmap

Kryv already uses secure live-state events, playback identifiers, recording, DVR-enabled provisioning, viewer counts, and a reconnect-safe state model. The next practical upgrades are closed-caption activation, low-latency mode after a controlled device test, creator analytics retention, simulcast destinations, and a dedicated operational alert when the provider sends failed-processing or prolonged-disconnect events. These should be introduced one at a time behind controlled release switches so the current working channel-creation flow is never disrupted.

## Cinema publishing workflow

The owner workflow is now deliberately gated:

1. Create a **title draft** with a rights or license reference.
2. Attach an **approved feature asset** using the VOD media/playback identity and record its provenance. Optional trailer, preview, and captions assets can be associated separately.
3. Create an active **rights window** with the commercial entitlement and optional territory scope.
4. Move the title to **review**.
5. Publication is enabled only when a ready feature asset and a currently active, configured rights window exist. The public Cinema service only surfaces titles that meet those gates.
6. Published titles get a Cinema detail page with feature playback, approved title metadata, an entitlement label, and an owner-controlled trailer indicator. Every owner workflow action is recorded in the audit trail.

Because location is optional, the first public Cinema release model safely exposes only globally available active rights windows. Territory-specific release requires a separate, explicit jurisdiction-selection or consented-location design; it should not silently infer a viewer’s location.

## Which Cinema system to use

You can absolutely own the **Kryv Cinema interface and operating rules**. That is what the new owner control plane does. You should not initially rebuild video ingest, transcoding, HLS packaging, device playback support, DRM licensing, and global delivery from zero.

| Approach | What Kryv owns | Tradeoffs | Setup complexity |
|---|---|---|---|
| **Current recommended direction: Kryv control plane + managed video layer** | Catalog, title versions, assets, artwork, trailers, rights windows, release gates, entitlements, audits, product experience | Fastest reliable route; depends on a managed video delivery provider for encoding and playback | Moderate; expand the existing owner desk and VOD ingestion path |
| **Full custom video platform** | Everything above plus storage, upload acceleration, transcoding, HLS/DASH packaging, CDN, analytics, DRM license operations, device compatibility, and incident response | Maximum control but very high reliability, legal, security, and operating burden | High; requires a dedicated video/platform engineering operation |
| **External media asset-management suite + Kryv delivery layer** | Viewer product and selected editorial controls; a specialist tool handles complex studio ingest/review workflows | Useful for large studios and many suppliers, but introduces another system and integration surface | Moderate to high |

The correct near-term approach is to continue designing the owner and Cinema experience in Kryv while using the existing managed video layer for ingestion, processing, playback, recording, and eventual DRM. FastPix’s VOD DRM capability supports Widevine, PlayReady, and FairPlay, but it requires separate provider onboarding, a DRM configuration, and protected playback/license tokens before it should be enabled for premium licensed movies. [2]

This mirrors the **principle**, not the private implementation, behind mature streaming systems: a central asset-management and policy layer tracks asset state, metadata, lifecycle, access, and approval; specialized media infrastructure processes and delivers the video. Netflix’s published engineering material describes that separation across asset management, policy, workflow, validation, versioning, and storage lifecycle. [3] [4]

## Next execution order

Run one real OBS broadcast test first. Then create one legally cleared Cinema test title, attach a real approved VOD playback asset, create a global active rights window, move it to review, publish it, and confirm that it appears on Cinema and plays on its title page. Once that works, the next implementation should be protected VOD upload from the owner desk, asset-processing webhooks, trailer playback, title metadata editing, and DRM activation only after the necessary provider onboarding and content-rights process are in place.

## References

[1] [FastPix, “Live stream with RTMPS.”](https://fastpix.com/docs/live-streaming/live-stream-with-rtmps)

[2] [FastPix, “Set up DRM encryption.”](https://docs.fastpix.io/docs/secure-playback-with-drm)

[3] [Netflix Technology Blog, “Netflix’s Media Landscape Evolution: From 3–2–1 to Cloud Storage Optimization.”](https://netflixtechblog.medium.com/netflixs-media-landscape-evolution-from-3-2-1-to-cloud-storage-optimization-77e9a19171ed)

[4] [Netflix Technology Blog, “The Netflix IMF Workflow.”](http://techblog.netflix.com/2016/04/the-netflix-imf-workflow.html)

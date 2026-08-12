# Kryv Category, Activity, and Cinema Operating Architecture

## Category architecture

The category table remains the authoritative taxonomy. This release adds curated records through a forward-only seed migration and keeps category cover artwork in the application’s versioned public asset library. Public cards resolve a local visual preset by category slug, so Kryv can ship original art, color, and motion without trusting a client-supplied image URL. The server continues to decide category membership, channel count, viewer count, and live state.

| Layer | Responsibility |
| --- | --- |
| Database | Stores the controlled category record, slug, kind, and image location. |
| API | Lists category records and aggregates server-authoritative live/viewer counts. |
| Public Live UI | Applies the original cover, accent, live indicator, and reduced-motion-safe decorative animation. |
| Creator Studio | Lets a creator select only a category that the API has made available. |
| Owner Console | Retains category governance as a controlled data operation, never a public write path. |

## In-app activity architecture

The owner activity feature is intentionally not a device viewer. Kryv will use existing activity logs and device history for the first owner detail view. A later presence layer can add a consent-gated current Kryv route, device class, and last-seen time. It must not capture screen pixels, content fields, sensitive routes, credentials, streams keys, payment details, or behavior outside the Kryv tab.

| Capability | Initial controlled release | Deferred until a separate privacy review |
| --- | --- | --- |
| User profile and channel context | Yes, owner-only | — |
| Existing login/device/activity history | Yes, owner-only | — |
| Route/action timeline | Yes, allow-listed and consent-gated | — |
| Current in-app state | Yes, short-lived heartbeat and only when consented | — |
| Visual replay of Kryv UI | No | Requires privacy provider, opt-in, source-side masking, retention controls, owner-access audit, and incident runbook. |
| Device camera, microphone, or outside-app screen | Never | Not a Kryv feature. |

## Cinema operating model

Kryv should operate Cinema as an owner/admin media desk on FastPix. An owner or admin creates a title and rights window in Kryv first. The server then creates a provider-signed direct upload only after it validates the title, role, allowed origin, and asset intent. The browser uploads to FastPix without receiving provider credentials. A signed provider webhook establishes the authoritative readiness state; only then can the owner publish after the existing asset and rights checks pass.

The final owner publishing console should provide a title record, media/upload state, art and trailer fields, subtitles/captions, rights window, region/access rules, readiness checks, revision history, and public catalog preview. The user-facing Cinema catalog should expose only a completed publishing state; it never contains a direct provider dashboard workflow.

## Hosting decision

The recommended production path is **extend FastPix VOD**. It keeps Kryv’s existing live and Cinema media lifecycles in one provider model and supports direct/resumable uploads. Cloudflare Stream is a strong managed alternative if cost or delivery requirements later justify a migration, while Mux is a comparable upload-and-webhook alternative. Neither alternative should be integrated at the same time as FastPix. A self-hosted media server is not a launch optimization because it would require persistent storage, transcode workers, ABR packaging, CDN, DRM key service, secure upload handling, monitoring, backup, and incident operations.

## Implementation order

First ship the category taxonomy, local visual language, mobile card presentation, and Creator Studio control repair. Second, add owner-detail history views that reuse already-recorded data and place observability behind a privacy control. Third, add the FastPix Cinema direct-upload session once the provider upload credentials and callback checks are configured. Visual session replay and any automated upload pipeline remain separately gated.

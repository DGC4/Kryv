# Kryv Category, Observability, and Cinema Source Notes

## Managed Cinema media workflow

Cloudflare Stream documents a managed path to upload, store, encode, and deliver live or on-demand video through one API, including adaptive H.264 playback between 360p and 1080p, signed URL access control, direct creator-upload URLs, and analytics. Its upload documentation lists dashboard, URL-import, direct-file, and direct-upload methods; it also states that files must be below 30 GB and identifies MP4/AAC/H.264 as recommended on-demand settings. [1] [2]

FastPix documents direct uploads using signed URLs and resumable web/mobile SDK workflows. The application server requests the signed URL and must keep provider credentials server-side; the direct-upload workflow returns an identifier that can be stored to reconcile upload progress and readiness. [3]

Mux documents a comparable direct-upload model: the application backend creates an authenticated upload URL, associates the resulting asset with application metadata, and processes asynchronous lifecycle events. [4]

**Implication for Kryv.** The owner-only Cinema desk should retain FastPix as the primary managed media provider because the live platform already uses it. The correct next implementation is a server-authorized, owner/admin-only direct-upload session that binds a Cinema title, asset manifest, and provider upload ID before a browser transfers bytes directly to the provider. Do not run a self-managed video-transcoding server at launch: it would create an always-on storage, transcoding, security, and CDN operations burden without improving the current owner publishing workflow.

## Consent-based activity observability

OpenReplay documents a private mode that records layout and interaction behavior while blocking visible text, network data, and console logs before they leave the browser. [5]

PostHog documents browser-side masking and opt-in/opt-out controls. Its privacy documentation describes an opt-out-by-default model where data is collected only after consent, and recommends a private-by-default capture approach where inputs and text are masked unless explicitly allowed. It also documents masking for selected elements and the ability to exclude sensitive areas from replay. [6] [7]

**Implication for Kryv.** Kryv must never attempt device-level viewing, webcam capture, background capture, or covert monitoring. A production-safe owner observability feature is scoped to the Kryv browser tab only, starts only after a clear analytics/session-improvement consent choice, captures no payment/payout/login/recovery/stream-key content, retains data for a short declared window, and restricts replay access to audited owner/admin roles. The initial release should use event telemetry (page views, feature use, errors, device class, and route transitions) and defer visual replay until consent, masking tests, retention controls, and owner-access audit logs are ready.

## References

[1]: https://developers.cloudflare.com/stream/ "Cloudflare Stream overview"
[2]: https://developers.cloudflare.com/stream/uploading-videos/ "Cloudflare Stream upload options"
[3]: https://fastpix.com/docs/upload-videos/upload-videos-from-device "FastPix direct uploads"
[4]: https://www.mux.com/docs/guides/upload-files-directly "Mux direct uploads"
[5]: https://docs.openreplay.com/en/sdk/private-mode/ "OpenReplay private mode"
[6]: https://posthog.com/docs/session-replay/privacy "PostHog session-replay privacy controls"
[7]: https://posthog.com/docs/privacy/data-collection "PostHog data collection controls"

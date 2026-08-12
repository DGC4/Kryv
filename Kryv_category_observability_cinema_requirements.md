# Kryv Category, Observability, and Cinema Requirements

## Product intent

Kryv Live needs a broader, recognizable browsing taxonomy with original visual identity rather than a thin list of games. Category covers should feel editorial and cinematic on both mobile and desktop, while active categories retain live viewer signals. The Creator Studio switch control must be tactile, accessible, and unambiguous in both states. Cinema remains a governed owner/admin publishing surface only.

## Live category model

The initial controlled taxonomy should distinguish high-level community themes from individual games. Kryv should launch with **Just Chatting**, **IRL & Travel**, **Music & DJs**, **Creative**, **Gaming**, **Esports**, **Sports**, **Talk & Podcasts**, **Tech & Building**, **Food & Culture**, **Fashion & Lifestyle**, and **Special Events**. Individual games can remain specific category records under the Gaming and Esports discovery rails. The taxonomy must not copy another platform’s cover art, names, or graphical treatment.

Every category needs an original cover treatment, an accent palette, concise description, a browse group, and a controlled active/featured state. The public UI may animate decorative gradients, subtle grain, moving light fields, and live indicators. It must honor reduced-motion preferences, never autoplay audio, never impact readability, and never depend on the client to determine live status.

## Creator control quality bar

Settings toggles must use a dedicated keyboard-accessible switch pattern with explicit `aria-checked`, a visible focus ring, a sufficient off-state contrast, a moving thumb, and a readable text state. Save actions remain explicit; switching a value locally must not alter server data until the owner or creator saves the relevant settings form.

## Consent-based activity visibility

Kryv may record a limited in-app activity timeline only after a clear opt-in choice. It may record the current Kryv route, page-class, device class, browser family, event name, and event timestamp. It must not record screen pixels, webcam or microphone input, keypress contents, stream keys, payout destinations, invoices, payment fields, login/recovery screens, authentication tokens, private messages, or activity outside the Kryv browser tab.

The first release uses server-authoritative event telemetry and presence heartbeats. It provides owners with a user detail view containing recent Kryv routes, a current in-app state when fresh, device summary, security-history summary, and audited access to that data. Visual session replay is deferred until a separate consent UX, private-by-default masking validation, retention settings, role-based access audit, incident runbook, and provider configuration are all complete.

## Cinema ingestion and publishing

Only owners and designated admins may create a Cinema upload session, attach media to a title, edit an asset manifest, complete readiness checks, and publish. Public users and ordinary creators must never receive a Cinema upload URL. The API server authorizes an owner/admin request, creates a provider-signed direct upload URL, binds the title and upload identifier in Kryv’s database, and lets the browser upload bytes directly to the managed media provider. Provider readiness webhooks, rights windows, asset manifests, and the existing audit history remain the publication authority.

The primary recommendation is to extend the existing FastPix integration for on-demand Cinema uploads, keeping live and VOD operations in one governed provider domain. Cloudflare Stream and Mux are viable managed alternatives but should not be introduced alongside FastPix during the current product pass. A self-managed video pipeline is deferred: it requires persistent object storage, secure ingest, transcoding, playback packaging, CDN delivery, media observability, and incident operations that do not improve the present owner-only launch workflow.

## Launch gates

The following controls must remain off until their preconditions are met: session observability needs a privacy notice, user opt-in, owner-access audit, retention policy, and masking tests; visual replay needs all of those requirements plus a selected provider and a separate production readiness review; Cinema direct upload needs provider credentials, webhook verification, title/asset linkage tests, rights readiness, and owner/admin role checks. No new category, activity, or Cinema feature bypasses the current server authority, crypto-only payment boundaries, or FastPix live lifecycle.

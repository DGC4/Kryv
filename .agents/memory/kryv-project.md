---
name: Kryv project shape
description: How the Kryv live-entertainment platform's three product surfaces (Live/Watch/Cinema) share one schema.
---

Kryv is one product with three linked surfaces: Kryv Live (Twitch/Kick-style real RTMP live streaming), Kryv Watch (YouTube-style creator VOD uploads), and Kryv Cinema (Netflix-style curated originals library). All three share one Clerk identity, one header/nav, and a rotating neon theme + animated canvas background as the signature brand mechanic.

**Why:** Avoids duplicating near-identical schema (categories/videos) across three "separate" products when the only real differences are a content-type/kind discriminator and which artwork fields the UI uses.

**How to apply:** `categories.kind` ("live_game" | "genre") — live_game feeds Kryv Live's browse sidebar, genre feeds Kryv Watch/Cinema. `videos.contentType` ("upload" | "original") — upload is creator VOD (Kryv Watch), original is curated library content (Kryv Cinema); both use the same Mux on-demand asset pipeline, just different artwork fields (thumbnailUrl for Watch grids vs. posterUrl/backdropUrl for Cinema rows/hero). No demo channels/streams/videos are ever seeded — only category taxonomy — because live/VOD content is only authentic once a real user creates it via real Mux flows.

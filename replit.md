# Kryv

Kryv is a live-entertainment platform combining three connected experiences under one account:

- **Kryv Live** — real-time broadcasting (Twitch/Kick-style): browse live channels by category, watch with live chat, go live yourself with real RTMP ingest.
- **Kryv Watch** — creator on-demand video (YouTube-style): upload, browse, and watch videos.
- **Kryv Cinema** — curated originals library (Netflix-style): hero banner + genre rows of featured titles.

All three share one identity system, one login, and a signature rotating neon color-theme + animated canvas background.

## Architecture

- **Monorepo**: pnpm workspace. See `.local/skills/pnpm-workspace/SKILL.md` for conventions.
- **Frontend** (`artifacts/blyze`, artifact title "Kryv"): React + Vite, wouter routing, TanStack Query, Tailwind, Clerk auth.
- **Backend** (`artifacts/api-server`): Express 5, contract-first via `lib/api-spec/openapi.yaml` → codegen (`lib/api-zod`, `lib/api-client-react`).
- **Database** (`lib/db`): Drizzle ORM / Postgres. Tables: `users`, `categories` (kind: live_game | genre), `channels`, `videos` (contentType: upload | original), `chat_messages`, `follows`.
- **Real video infrastructure**: Mux Video powers both real RTMP live streaming (Kryv Live) and real on-demand upload/transcoding (Kryv Watch/Cinema) — no simulated/mocked video anywhere. A Mux webhook (`/api/webhooks/mux`, raw body) keeps `isLive` and video `uploadStatus`/`playbackId` in sync with real broadcasts and uploads.
- **Auth**: Clerk (proxy middleware + `clerkMiddleware`), JIT-provisions a local `users` row on first authenticated request.

## Notable decisions

- The artifact's internal directory/slug remains `blyze` (renaming is a heavy operation); only the artifact `title` and all UI copy are branded "Kryv".
- `categories.kind` distinguishes Kryv Live's game/IRL categories from Kryv Watch/Cinema's genres, sharing one table instead of two parallel ones.
- `videos` table powers both Kryv Watch (`contentType: "upload"`) and Kryv Cinema (`contentType: "original"`) — same on-demand playback pipeline, differentiated by content type and artwork fields (thumbnail vs. poster/backdrop).
- No demo/placeholder channels, streams, or videos are seeded — only the category taxonomy. Live and on-demand content only ever appears once real users create it for real, keeping the "no mocked functional data" principle intact.

## User preferences

- Wants real infrastructure, not simulated/demo video — Mux was chosen deliberately for real RTMP + real on-demand playback since Replit has no first-party live-streaming integration.
- Rejected several platform name candidates before "Kryv" was chosen autonomously per their "figure it out" instruction.
- Prefers the agent to make naming/creative decisions independently rather than asking repeatedly.
- GitHub connector is not available on their plan — connecting to GitHub for this project goes through a user-provided Personal Access Token instead of the connector flow.

# Kryv

Kryv is a live-entertainment platform with three connected experiences under one account:

- **Kryv Live** — category-based real-time broadcasting with public viewing, live chat, and RTMP ingest.
- **Kryv Watch** — creator on-demand video upload, discovery, and playback.
- **Kryv Cinema** — a curated, account-gated originals library.

The products share one identity system, a rotating neon theme, and an animated background.

## Architecture

- **Monorepo:** pnpm workspace.
- **Frontend:** `artifacts/blyze` uses React, Vite, wouter, TanStack Query, and Tailwind CSS.
- **Backend:** `artifacts/api-server` uses Express and a contract-first API generated from `lib/api-spec/openapi.yaml` into `lib/api-zod` and `lib/api-client-react`.
- **Authentication:** Kryv uses its own JWT-backed account system with local user records; it does not use Clerk.
- **Database:** `lib/db` uses Drizzle ORM with Neon Postgres. Core tables cover users, categories, channels, videos, chat, follows, viewer sessions, stream sessions, visitor analytics, moderation, and creator engagement.
- **Video infrastructure:** FastPix powers RTMP ingest, live HLS playback, on-demand processing, viewer-count measurement, and live lifecycle webhooks. The FastPix webhook route is `/api/webhooks/fastpix`.

## Operating Model

- `categories.kind` separates Live categories from Watch and Cinema genres while sharing one taxonomy table.
- The `videos` table supports both Watch uploads and Cinema originals through `contentType` and related presentation fields.
- Live broadcasts are public to watch, while authenticated accounts are required for chat, following, creator tools, and Cinema access.
- Live discovery and category pages order active broadcasts by FastPix-backed viewer count.
- No demo channels, streams, or videos are seeded; real content appears only after creator action.

## Repository Safety

Do not commit credentials, stream keys, access tokens, webhook secrets, or other private configuration values. Use the deployed environment’s secret manager for all production credentials.

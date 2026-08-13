# Official YouTube Watch Source Verification

## Automated checks

The workspace passed both `pnpm run typecheck` and `pnpm run build` after the official YouTube source implementation. The production build completed the library build, API bundle, and Vite client bundle successfully.

## Local browser smoke check

The local Vite route `/watch/1` loaded the Kryv application shell successfully. With no seeded API record at video ID `1`, the Watch detail rendered the intentional **“Video unavailable”** state and a working return path to `/watch`; no browser console error was reported. This confirms the client route remains stable in the no-data local environment, but cannot exercise a real FastPix or YouTube record without a configured local API and seeded rights-cleared video.

## Required production smoke test

After applying `lib/db/drizzle/0013_video_youtube_sources.sql`, create a creator-owned Watch item through **Dashboard → Watch → Official YouTube**. Use a valid video ID, check the rights-attestation control, then open `/watch/:id` and confirm the `youtube-nocookie.com` embed loads. Also confirm a missing attestation or malformed ID is rejected by the generated request validation and server route.

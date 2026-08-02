# Kryv Creator Dashboard

Kryv Creator Dashboard is a responsive, dark-themed creator control center built with React, Tailwind CSS, Express, tRPC, Drizzle, MySQL/TiDB, and Manus OAuth. Every dashboard route requires an authenticated creator session, and all server-side creator operations are scoped to the authenticated user.

## Delivered creator experience

| Area | Included implementation |
|---|---|
| Creator home | Live/offline status, current viewer count, follower and revenue summaries, quick-start guidance, and an account-scoped activity feed. |
| Stream setup | Stream title/category controls, protected stream-key generation and rotation, one-time display of a newly generated key, masking, copy controls, encoder recommendations, and OBS guidance. |
| Profile & channel | Editable display name, bio, HTTPS avatar URL, brand color, channel preview, and authenticated owner-badge treatment. |
| Analytics | Viewer and follower-growth trend charts backed by recorded stream sessions, plus a stream-history table. |
| Monetization | Recorded revenue summary, payout status/history, and clearly labeled subscription-tier planning cards. |
| Notifications | Persisted preferences for stream, follower, revenue, and weekly-digest alerts. |

## Security model

The dashboard uses the scaffolded **Manus OAuth** session flow. Dashboard UI routes are wrapped in the authenticated `DashboardLayout`, while creator data is exposed exclusively through `protectedProcedure` tRPC routes.

> Stream keys are generated with cryptographically secure random bytes and stored as a SHA-256 hash. The complete key is returned only in the immediate generation response; subsequent dashboard reads expose only a masked preview.

## Local workflow

Run the following from this directory.

```bash
pnpm test
pnpm check
pnpm run dev
```

The schema history contains the initial `users` migration and the creator-dashboard migration. Apply the reviewed migrations to a fresh database in their natural order before using the app outside the managed environment.

## Live streaming activation

The dashboard is ready to store and safely rotate creator credentials, but **actual live broadcasting, verified concurrent-viewer counts, playback, chat, and payouts require external production services**. Configure a trusted RTMP ingest endpoint through `KRYV_RTMP_SERVER_URL`, then connect your chosen streaming, playback, analytics, chat, billing, and notification providers before representing these features as live to end users.

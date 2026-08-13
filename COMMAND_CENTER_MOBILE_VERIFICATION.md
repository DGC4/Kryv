# Command Center and Mobile Profile Verification

## Build verification

The current workspace passed `pnpm run typecheck` and `pnpm run build` after the mobile creator-profile and owner command-overview work. The production build completed the library build, API bundle, and Vite client bundle successfully.

## Local browser smoke check

The local Vite route `/profile/fano` rendered the Kryv shell and the intentional **Creator profile unavailable** fallback without a browser error. Because the local preview has no seeded API profile record or configured owner session, this browser environment cannot exercise populated profile tabs or owner-only overview data.

## Production click paths

After deploying the generated API contract and database environment, verify these paths with real records:

1. Open `/profile/:slug` at a 390px viewport. Confirm both hero actions remain reachable, the tab rail scrolls rather than clips, and Watch/Cinema tiles form two compact columns.
2. Sign in as owner and open `/dashboard/admin`. Confirm **Overview** is the default tab and contains only real counts, statuses, asset-separated movement totals, and disabled capability badges.
3. Open **Videos** in the owner console. Confirm a YouTube item displays its source and rights-attestation timestamp; FastPix items do not claim an attestation.
4. Confirm Operations, Finance, Safety, Cinema, and all existing owner controls retain their current authorization and confirmation behavior.

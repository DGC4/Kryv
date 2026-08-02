# Deploying Kryv outside Replit (Render + Neon)

This guide covers self-hosting Kryv on Render.com with a Neon.tech Postgres database,
once you're ready to run it outside the Replit environment. It assumes you already
have (or will provision):

- A Neon.tech Postgres project (gives you a `DATABASE_URL`)
- Your Clerk keys (`CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and the matching
  publishable key for the backend if your Clerk setup needs it)
- Your Mux keys (`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`), plus a Mux webhook signing
  secret you'll create in the next step
- A `SESSION_SECRET` (any long random string)

Kryv can be deployed as two separate services (recommended for scale) or as a single unified service (easier to manage).

### Option A: Unified Service (Backend + Frontend together)
This is the simplest way to get up and running. The backend will serve the frontend assets.

- **Service Type**: Web Service
- **Root Directory**: repo root
- **Build Command**: `corepack enable && pnpm install && pnpm --filter @workspace/blyze build && pnpm --filter @workspace/api-server build`
- **Start Command**: `node artifacts/api-server/dist/index.mjs`
- **Environment Variables**: See Backend variables below.

### Option B: Separate Services
Deploy the backend as a Web Service and the frontend as a Static Site.

## 1. Database (Neon)

1. Create a Neon project and copy its connection string — that's your `DATABASE_URL`.
   It's already Postgres-compatible with the Drizzle setup used here, no code changes
   needed.
2. Before your first deploy, run the schema push against that database from your
   local machine or a one-off Render shell:
   ```
   DATABASE_URL="<your neon url>" pnpm --filter @workspace/db run push
   ```
   Re-run this any time the schema changes (e.g. after pulling future updates).
3. If you deployed an earlier Kryv revision that wrote stream keys to the database,
   run this one-time cleanup before enabling Mux live ingest. It removes only the
   legacy database copy; it does not invalidate a creator’s Mux configuration.
   ```
   DATABASE_URL="<your neon url>" pnpm --filter @workspace/db run clear:legacy-stream-keys
   ```

## 2. Backend — Render Web Service

- **Root directory**: repo root (the build needs the full pnpm workspace)
- **Environment**: Node
- **Build command**:
  ```
  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
  ```
- **Start command**:
  ```
  node artifacts/api-server/dist/index.mjs
  ```
- **Environment variables**:
  | Key | Value |
  |---|---|
  | `DATABASE_URL` | your Neon connection string |
  | `CLERK_SECRET_KEY` | your Clerk secret key |
  | `MUX_TOKEN_ID` | your Mux token id |
  | `MUX_TOKEN_SECRET` | your Mux token secret |
  | `MUX_WEBHOOK_SECRET` | signing secret from the Mux webhook you create below |
  | `SESSION_SECRET` | a long random string |
  | `NODE_ENV` | `production` |
  | `CORS_ORIGIN` | the URL of your deployed frontend, e.g. `https://kryv.onrender.com` |
  | `PORT` | leave unset — Render injects this automatically and the server already reads `process.env.PORT` |

- **Mux webhook**: in the Mux dashboard, create a webhook pointed at
  `https://<your-backend-domain>/api/webhooks/mux`, then copy its signing secret into
  `MUX_WEBHOOK_SECRET` above. This is what keeps `isLive` status and upload processing
  state in sync with real Mux events once you're off Replit's proxy.

## 3. Frontend — Render Static Site (or Web Service)

- **Root directory**: repo root
- **Build command**:
  ```
  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/blyze run build
  ```
- **Publish directory**: `artifacts/blyze/dist`
- **Environment variables** (build-time, since Vite inlines them):
  | Key | Value |
  |---|---|
  | `VITE_CLERK_PUBLISHABLE_KEY` | your Clerk publishable key |
  | `VITE_API_URL` | your backend's public URL, e.g. `https://kryv-api.onrender.com` (only add this if the frontend doesn't already infer the API origin — check `artifacts/blyze/src/lib/queryClient.ts` for how the API base is resolved before hardcoding this) |
- **Rewrite rule**: add a catch-all rewrite so client-side routing works —
  source `/*` → destination `/index.html` (rewrite, not redirect).

## 4. Clerk configuration

In your Clerk dashboard, add your Render frontend domain (and backend domain, if
Clerk validates it) to the allowed origins/redirect URLs for your Clerk instance,
the same way you would for any Clerk deployment outside Replit's managed proxy.

## 5. Verify

1. Open the frontend URL, sign up, confirm `/api/me` resolves (check browser network
   tab) against your backend URL, not `localhost`.
2. Go live or upload a test video and confirm Mux ingest/webhook events land
   (check backend logs for `/api/webhooks/mux` requests).
3. Sign in as the account named exactly "Fano DGC" and confirm the Owner Console
   (`/dashboard/admin`) loads — that account is auto-promoted to the owner role on
   sign-in by username match.

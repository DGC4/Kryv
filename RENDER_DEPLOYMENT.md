# Deploying Kryv outside Replit (Render + Neon)

This guide covers self-hosting Kryv on Render.com with a Neon.tech Postgres database,
once you're ready to run it outside the Replit environment. It assumes you already
have (or will provision):

- A Neon.tech Postgres project (gives you a `DATABASE_URL`)
- Your Mux keys (`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`), plus a Mux webhook signing
  secret you'll create in the next step
- A `JWT_SECRET` (any long random string for authentication)

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

The project uses a Neon serverless Postgres database. The Neon project is named **kryv**
(`bold-cake-75596541`) in the `us-west-2` region.

Your `DATABASE_URL` is:
```
postgresql://neondb_owner:<password>@ep-rapid-lab-a602x70b-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

The schema is already applied. If you ever need to re-apply it (e.g. after pulling
schema changes), run from your local machine or a one-off Render shell:
```
DATABASE_URL="<your neon url>" pnpm --filter @workspace/db run push
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
  | `JWT_SECRET` | a long random string for auth |
  | `MUX_TOKEN_ID` | your Mux token id |
  | `MUX_TOKEN_SECRET` | your Mux token secret |
  | `MUX_WEBHOOK_SECRET` | signing secret from the Mux webhook you create below |
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
  | `VITE_API_URL` | your backend's public URL, e.g. `https://kryv-api.onrender.com` |
- **Rewrite rule**: add a catch-all rewrite so client-side routing works —
  source `/*` → destination `/index.html` (rewrite, not redirect).

## 4. Verify

1. Open the frontend URL, sign up, confirm `/api/me` resolves (check browser network
   tab) against your backend URL, not `localhost`.
2. Go live or upload a test video and confirm Mux ingest/webhook events land
   (check backend logs for `/api/webhooks/mux` requests).
3. Sign in as **FanoDGC** and confirm the Owner Console (`/dashboard/admin`) loads —
   that account is automatically promoted to the `owner` role on sign-in by username match.

## 5. Local Windows build fix

If you see `Cannot find module @rollup/rollup-win32-x64-msvc` or
`The package "@esbuild/win32-x64" could not be found` when building locally on Windows,
delete `node_modules` at the repo root and reinstall:

```powershell
Remove-Item -Recurse -Force node_modules
npx -y pnpm@latest install
```

This forces pnpm to download the correct Windows-native optional binaries.

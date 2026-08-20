import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function requireMatch(content, expression, label) {
  assert.match(content, expression, label);
}

function forbidMatch(content, expression, label) {
  assert.doesNotMatch(content, expression, label);
}

const [
  authLib,
  authRoute,
  authStore,
  customFetch,
  migration,
  renderBlueprint,
  ownerBootstrap,
  channelPage,
] = await Promise.all([
  source("artifacts/api-server/src/lib/auth.ts"),
  source("artifacts/api-server/src/routes/auth.ts"),
  source("artifacts/blyze/src/lib/auth-store.ts"),
  source("lib/api-client-react/src/custom-fetch.ts"),
  source("lib/db/drizzle/0020_identity_and_session_hardening.sql"),
  source("render.yaml"),
  source("scripts/seed-owner.ts"),
  source("artifacts/blyze/src/pages/live/Channel.tsx"),
]);

requireMatch(authLib, /httpOnly:\s*true/, "Secure sessions must be HttpOnly.");
requireMatch(
  authLib,
  /SESSION_COOKIE_NAME/,
  "Secure session cookie naming must be explicit.",
);
requireMatch(
  authLib,
  /requireTrustedSessionOrigin/,
  "Cookie-authenticated writes must validate the request origin.",
);
requireMatch(
  authLib,
  /revokeAllUserSessions/,
  "Account-wide session invalidation must remain available.",
);
requireMatch(
  authRoute,
  /await establishSession\(req, res, user\)/,
  "Sign-in and sign-up must establish an opaque session.",
);
requireMatch(
  authRoute,
  /username\.toLowerCase\(\) === OWNER_USERNAME\.toLowerCase\(\)/,
  "Reserved owner display name must be protected.",
);
forbidMatch(
  authRoute,
  /const role\s*=\s*username/,
  "Public registration must never assign an owner role from a username.",
);
forbidMatch(
  authRoute,
  /token\s*,\s*user:/,
  "Authentication responses must not return browser access tokens.",
);

forbidMatch(
  authStore,
  /token:\s*string/,
  "Client auth state must not retain bearer tokens.",
);
forbidMatch(
  customFetch,
  /localStorage\.getItem\(\s*["']kryv-auth/,
  "Generated client must not read a persisted browser token.",
);
requireMatch(
  customFetch,
  /credentials:\s*init\.credentials \?\? ["']include["']/,
  "Browser requests must include the secure session cookie.",
);
forbidMatch(
  channelPage,
  /Authorization:\s*`Bearer/,
  "Direct client calls must not inject a browser bearer token.",
);

requireMatch(
  migration,
  /CREATE TABLE IF NOT EXISTS platform_roles/,
  "Explicit platform roles must be migrated.",
);
requireMatch(
  migration,
  /CREATE TABLE IF NOT EXISTS user_sessions/,
  "Revocable session records must be migrated.",
);
requireMatch(
  migration,
  /session_version/,
  "Account-wide session versioning must be migrated.",
);
forbidMatch(
  ownerBootstrap,
  /onlyus123|fano@kryv\.build/,
  "Owner bootstrap must not embed credentials or personal account data.",
);
requireMatch(
  ownerBootstrap,
  /PROMOTE_EXISTING_OWNER/,
  "Owner bootstrap must require deliberate operator confirmation.",
);

requireMatch(
  renderBlueprint,
  /autoDeployTrigger:\s*checksPass/,
  "Production deployment must wait for CI checks.",
);
requireMatch(
  renderBlueprint,
  /KRYV_ACTIVITY_TRACKING_ENABLED[\s\S]*value:\s*["']false["']/,
  "Visitor tracking must remain disabled by default.",
);
requireMatch(
  renderBlueprint,
  /KRYV_DEBUG_ENDPOINTS_ENABLED[\s\S]*value:\s*["']false["']/,
  "Diagnostic endpoints must remain disabled by default.",
);

console.log("Security hardening regression checks passed.");

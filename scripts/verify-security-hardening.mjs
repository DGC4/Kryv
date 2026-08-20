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
  profileRoute,
  cinemaHome,
  cinemaDetail,
  cinemaRoute,
  apiSpec,
  adsRoute,
  adSlot,
] = await Promise.all([
  source("artifacts/api-server/src/lib/auth.ts"),
  source("artifacts/api-server/src/routes/auth.ts"),
  source("artifacts/blyze/src/lib/auth-store.ts"),
  source("lib/api-client-react/src/custom-fetch.ts"),
  source("lib/db/drizzle/0020_identity_and_session_hardening.sql"),
  source("render.yaml"),
  source("scripts/seed-owner.ts"),
  source("artifacts/blyze/src/pages/live/Channel.tsx"),
  source("artifacts/api-server/src/routes/me.ts"),
  source("artifacts/blyze/src/pages/cinema/Home.tsx"),
  source("artifacts/blyze/src/pages/cinema/Detail.tsx"),
  source("artifacts/api-server/src/routes/cinema.ts"),
  source("lib/api-spec/openapi.yaml"),
  source("artifacts/api-server/src/routes/ads.ts"),
  source("artifacts/blyze/src/components/ads/AdSlot.tsx"),
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
  authLib,
  /PROFILE_GRANT_COOKIE_NAME/,
  "Viewer profile selection must use an explicit HttpOnly cookie name.",
);
requireMatch(
  authLib,
  /establishActiveProfileGrant/,
  "Viewer profile selection must be established only through a session-bound grant.",
);
requireMatch(
  authLib,
  /payload\.sessionId === row\.session\.id/,
  "Viewer profile grants must be bound to the current opaque session.",
);
requireMatch(
  authLib,
  /IS_PRODUCTION && !JWT_SECRET/,
  "Production must fail closed when the session/profile signing secret is missing.",
);
requireMatch(
  authLib,
  /IS_PRODUCTION && !REALTIME_TOKEN_SECRET/,
  "Production must fail closed when the realtime signing secret is missing.",
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
forbidMatch(
  cinemaHome,
  /localStorage/,
  "Cinema profile selection must not persist profile identifiers in browser storage.",
);
requireMatch(
  cinemaHome,
  /\/me\/profiles\/active/,
  "Cinema must restore and clear only a server-issued active-profile grant.",
);
requireMatch(
  cinemaHome,
  /\/me\/profiles\/\$\{profile\.id\}\/select/,
  "Cinema profile selection must call the server-owned selection endpoint.",
);
requireMatch(
  cinemaHome,
  /maturityFilteredRows/,
  "Cinema discovery must filter the active profile's hero and rails by maturity setting.",
);
requireMatch(
  cinemaDetail,
  /\/me\/profiles\/active/,
  "Cinema detail must hydrate the server-issued active-profile grant before requesting playback data.",
);
requireMatch(
  cinemaDetail,
  /maturityBlocked/,
  "Cinema detail must withhold feature and trailer playback below the active profile's maturity setting.",
);
requireMatch(
  cinemaDetail,
  /!maturityBlocked && activeProfile/,
  "Cinema detail must avoid mounting profile-gated discussion unless the active profile is eligible.",
);
requireMatch(
  cinemaRoute,
  /router\.get\("\/cinema\/home",\s*attachUserId/,
  "Cinema home must resolve the optional session and active-profile grant server-side.",
);
requireMatch(
  cinemaRoute,
  /profileFilteredTitles/,
  "Cinema home must filter signed-in catalog rows by active profile maturity.",
);
requireMatch(
  cinemaRoute,
  /function toCinemaCatalogCard[\s\S]*?featurePlaybackId:\s*null,[\s\S]*?trailerPlaybackId:\s*null/,
  "Cinema catalog cards must not expose feature or trailer playback identifiers.",
);
requireMatch(
  cinemaRoute,
  /router\.get\(\s*"\/cinema\/titles\/:id",\s*attachUserId/,
  "Cinema title detail must resolve the optional session and active-profile grant server-side.",
);
requireMatch(
  cinemaRoute,
  /Select a viewer profile to request Cinema playback\./,
  "Cinema title detail must fail closed without an active profile grant.",
);
requireMatch(
  cinemaRoute,
  /This title is outside the active profile's maturity setting\./,
  "Cinema title detail must fail closed when the active profile maturity is insufficient.",
);
requireMatch(
  cinemaRoute,
  /featurePlaybackId:\s*null,[\s\S]*?trailerPlaybackId:\s*null/,
  "Cinema playback restriction must remove both feature and trailer playback identifiers.",
);
requireMatch(
  cinemaRoute,
  /function getCinemaDiscussionRestriction/,
  "Cinema discussion must use an active-profile maturity restriction helper.",
);
requireMatch(
  cinemaRoute,
  /\/cinema\/titles\/:id\/comments",\s*attachUserId/,
  "Cinema discussion reads must resolve optional session and active-profile context.",
);
requireMatch(
  cinemaRoute,
  /Select a viewer profile to access Cinema discussion\./,
  "Cinema discussion must fail closed without an active profile.",
);
requireMatch(
  cinemaRoute,
  /This Cinema discussion is outside the active profile's maturity setting\./,
  "Cinema discussion must fail closed below profile maturity.",
);
requireMatch(
  profileRoute,
  /PROFILE_PIN_MAX_ATTEMPTS/,
  "Profile PIN attempts must be bounded.",
);
requireMatch(
  profileRoute,
  /viewer_profile_pin_failed/,
  "Failed profile PIN attempts must be durably audited for throttling.",
);
requireMatch(
  profileRoute,
  /bcrypt\.compare\(parsed\.data\.currentPassword, user\.passwordHash\)/,
  "Profile PIN changes must require account-password re-authentication.",
);
requireMatch(
  profileRoute,
  /clearActiveProfileGrant\(res\)/,
  "Profile PIN changes and explicit switching must revoke the active-profile grant.",
);
requireMatch(
  profileRoute,
  /action: "viewer_profile_updated"[\s\S]*?clearActiveProfileGrant\(res\)|clearActiveProfileGrant\(res\)[\s\S]*?action: "viewer_profile_updated"/,
  "Profile updates must revoke the active-profile grant and be auditable.",
);
requireMatch(
  profileRoute,
  /action: "viewer_profile_deleted"[\s\S]*?clearActiveProfileGrant\(res\)|clearActiveProfileGrant\(res\)[\s\S]*?action: "viewer_profile_deleted"/,
  "Profile deletion must revoke the active-profile grant and be auditable.",
);
requireMatch(
  profileRoute,
  /existing\.isDefault && parsed\.data\.isDefault === false/,
  "The current default profile must not be unset without choosing another default.",
);
requireMatch(
  apiSpec,
  /\/me\/profiles\/\{id\}\/select/,
  "The secured viewer-profile selection endpoint must remain documented.",
);
requireMatch(
  apiSpec,
  /\/me\/profiles\/\{id\}\/pin/,
  "The re-authenticated viewer-profile PIN endpoint must remain documented.",
);
requireMatch(
  apiSpec,
  /isLocked:/,
  "The public profile contract may disclose lock state but never PIN material.",
);
requireMatch(
  adsRoute,
  /AD_DELIVERY_RUNTIME_ENABLED\s*=\s*false/,
  "Advertising delivery must remain explicitly disabled during control-plane work.",
);
requireMatch(
  adsRoute,
  /req\.activeProfileId !== profileId/,
  "Future profile-aware advertising decisions must require the session-bound active profile grant.",
);
requireMatch(
  adsRoute,
  /frequency_policy_required/,
  "Future advertising decisions must fail closed when campaign frequency policy is absent or malformed.",
);
requireMatch(
  adsRoute,
  /frequency_cap_reached/,
  "Future advertising decisions must enforce a qualified-delivery frequency cap.",
);
requireMatch(
  adsRoute,
  /deliveryStatus\} IN \('qualified', 'completed'\)/,
  "Only qualified or completed delivery records may count toward advertising frequency policy.",
);
requireMatch(
  adSlot,
  /AD_DELIVERY_PRESENTATION_ENABLED\s*=\s*false/,
  "Advertising presentation must remain independently disabled by default.",
);
requireMatch(
  adSlot,
  /new URL\(value\)\.protocol === "https:"/,
  "Advertising presentation must reject non-HTTPS creative asset URLs.",
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

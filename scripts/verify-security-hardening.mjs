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
  liveDashboard,
  profileRoute,
  cinemaHome,
  cinemaDetail,
  cinemaRoute,
  apiSpec,
  adsRoute,
  adSlot,
  chartComponent,
  liveChannelRoute,
  liveChatRoute,
  liveClipsRoute,
  liveMaturity,
  focusModeShell,
  discoverRoute,
  meRoute,
  appServer,
  watchDetail,
  themeStore,
  plisioLib,
  routeRegistry,
  worker,
  videosRoute,
] = await Promise.all([
  source("artifacts/api-server/src/lib/auth.ts"),
  source("artifacts/api-server/src/routes/auth.ts"),
  source("artifacts/blyze/src/lib/auth-store.ts"),
  source("lib/api-client-react/src/custom-fetch.ts"),
  source("lib/db/drizzle/0020_identity_and_session_hardening.sql"),
  source("render.yaml"),
  source("scripts/seed-owner.ts"),
  source("artifacts/blyze/src/pages/live/Channel.tsx"),
  source("artifacts/blyze/src/pages/dashboard/Live.tsx"),
  source("artifacts/api-server/src/routes/me.ts"),
  source("artifacts/blyze/src/pages/cinema/Home.tsx"),
  source("artifacts/blyze/src/pages/cinema/Detail.tsx"),
  source("artifacts/api-server/src/routes/cinema.ts"),
  source("lib/api-spec/openapi.yaml"),
  source("artifacts/api-server/src/routes/ads.ts"),
  source("artifacts/blyze/src/components/ads/AdSlot.tsx"),
  source("artifacts/blyze/src/components/ui/chart.tsx"),
  source("artifacts/api-server/src/routes/channels.ts"),
  source("artifacts/api-server/src/routes/chat.ts"),
  source("artifacts/api-server/src/routes/clips.ts"),
  source("artifacts/api-server/src/lib/liveMaturity.ts"),
  source("artifacts/blyze/src/components/focus/FocusModeShell.tsx"),
  source("artifacts/api-server/src/routes/discover.ts"),
  source("artifacts/api-server/src/routes/me.ts"),
  source("artifacts/api-server/src/app.ts"),
  source("artifacts/blyze/src/pages/watch/Detail.tsx"),
  source("artifacts/blyze/src/store/theme.ts"),
  source("artifacts/api-server/src/lib/plisio.ts"),
  source("artifacts/api-server/src/routes/index.ts"),
  source("artifacts/api-server/src/worker.ts"),
  source("artifacts/api-server/src/routes/videos.ts"),
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
  liveDashboard,
  /navigator\.geolocation/,
  "Live creator setup must not trigger browser geolocation without a separately reviewed consent flow.",
);
forbidMatch(
  liveDashboard,
  /fetch\(['"]\/api\/location/,
  "Live creator setup must not silently collect approximate IP location.",
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
  adsRoute,
  /ad_campaign_approval_required/,
  "Future ad delivery must require an explicit operator-approved campaign.",
);
requireMatch(
  adsRoute,
  /ad_campaign_budget_exhausted/,
  "Future paid campaigns must fail closed once the approved budget has no remaining capacity.",
);
requireMatch(
  adsRoute,
  /isHttpsUrl\(creative\.assetUrl\)/,
  "Future ad creatives must reject non-HTTPS asset URLs.",
);
requireMatch(
  adsRoute,
  /isHttpsUrl\(creative\.landingUrl\)/,
  "Future ad creatives must reject non-HTTPS landing URLs.",
);
requireMatch(
  adsRoute,
  /ALLOWED_CREATIVE_TYPES/,
  "Ad decisions must restrict creative types to the reviewed allowlist.",
);
requireMatch(
  adsRoute,
  /parsed\.protocol === "https:" && !parsed\.username && !parsed\.password/,
  "Advertising creative and landing URLs must require clean HTTPS authorities.",
);
requireMatch(
  adsRoute,
  /creative_duration_not_allowed/,
  "Future video creatives must have bounded duration compatible with the ad pod.",
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
  chartComponent,
  /SAFE_CHART_KEY/,
  "Dynamic chart CSS custom-property names must be allowlisted.",
);
requireMatch(
  chartComponent,
  /safeChartColor/,
  "Dynamic chart CSS values must be sanitized before style injection.",
);
requireMatch(
  liveMaturity,
  /req\.activeProfileId/,
  "Mature Live eligibility must require the session-bound active profile grant.",
);
requireMatch(
  liveMaturity,
  /profileMaturity !== "mature"/,
  "Mature Live eligibility must fail closed for kids and standard profiles.",
);
requireMatch(
  liveChannelRoute,
  /!channel\.matureContent \|\| profileMaturity === "mature"/,
  "Live discovery must omit mature channels without an eligible profile.",
);
requireMatch(
  liveChannelRoute,
  /getLiveMaturityRestriction\(req, channel\)/,
  "Live detail and audience metadata must apply the active-profile maturity guard.",
);
requireMatch(
  liveChannelRoute,
  /playbackBlockedReason/,
  "Live detail must withhold playback identifiers with a viewer-safe restriction reason.",
);
requireMatch(
  liveChatRoute,
  /getLiveMaturityRestriction\(req, channel\)/,
  "Mature Live chat reads and writes must enforce the same profile gate.",
);
requireMatch(
  liveClipsRoute,
  /!row\.channel\.matureContent \|\| profileMaturity === "mature"/,
  "Live clip discovery must omit clips sourced from restricted mature channels.",
);
requireMatch(
  liveClipsRoute,
  /getLiveMaturityRestriction\(req, liveChannel\)/,
  "Viewer-created Live clips must not bypass mature-profile restrictions.",
);
requireMatch(
  liveClipsRoute,
  /getLiveMaturityRestriction\(req, row\.channel\)/,
  "Direct mature-source clip playback must enforce the active-profile guard.",
);
requireMatch(
  channelPage,
  /channel\.playbackAvailable/,
  "The primary Live player must honor the server-authoritative playback availability flag.",
);
requireMatch(
  focusModeShell,
  /channel\?\.playbackAvailable/,
  "Kryv Focus Live playback must honor the server-authoritative playback availability flag.",
);
requireMatch(
  discoverRoute,
  /const visibleLiveChannels = liveChannels\.filter/,
  "Shared cached Live discovery must exclude mature rooms from public payloads.",
);
requireMatch(
  discoverRoute,
  /!channel\.matureContent \|\| profileMaturity === "mature"/,
  "Live search and followed-live discovery must filter mature channels by active profile maturity.",
);
requireMatch(
  discoverRoute,
  /const visibleClips = clips\.filter/,
  "Live search must build a mature-profile-filtered clip result set.",
);
requireMatch(
  meRoute,
  /!channel\.matureContent \|\| profileMaturity === "mature"/,
  "Account-summary followed channels must filter mature Live rooms by active profile maturity.",
);
requireMatch(
  appServer,
  /baseUri:\s*\["'self'"\]/,
  "Content Security Policy must lock the document base URI to the current origin.",
);
requireMatch(
  appServer,
  /formAction:\s*\["'self'"\]/,
  "Content Security Policy must prevent cross-origin form submissions.",
);
requireMatch(
  appServer,
  /frameAncestors:\s*\["'self'"\]/,
  "Content Security Policy must prevent third-party framing.",
);
requireMatch(
  appServer,
  /objectSrc:\s*\["'none'"\]/,
  "Content Security Policy must prohibit plugin content.",
);
requireMatch(
  appServer,
  /upgradeInsecureRequests/,
  "Production Content Security Policy must upgrade insecure subresource requests.",
);
requireMatch(
  appServer,
  /strict-origin-when-cross-origin/,
  "Referrer policy must limit cross-origin URL disclosure.",
);
requireMatch(
  appServer,
  /Permissions-Policy/,
  "Server responses must set an explicit sensitive-browser-capability policy.",
);
requireMatch(
  appServer,
  /camera=\(\), geolocation=\(\), microphone=\(\), payment=\(\), usb=\(\)/,
  "Sensitive browser capabilities must remain disabled unless separately reviewed.",
);
requireMatch(
  appServer,
  /req\.originalUrl\.startsWith\("\/api\/webhooks\/"\)/,
  "The general API limiter must exempt provider webhooks using the mount-safe original request URL.",
);
requireMatch(
  appServer,
  /const profileSecurityLimiter = rateLimit/,
  "Profile unlock and PIN-reset routes must retain a dedicated network-level rate limiter.",
);
requireMatch(
  appServer,
  /kryv:rate:profile-security:/,
  "Profile security rate-limit state must be independently scoped.",
);
requireMatch(
  appServer,
  /app\.use\("\/api\/me\/profiles"[\s\S]*?req\.method === "POST"[\s\S]*?\(select\|pin\)[\s\S]*?profileSecurityLimiter/,
  "Profile security rate limiting must remain narrowly scoped to POST select and PIN-reset paths.",
);
requireMatch(
  profileRoute,
  /PROFILE_PIN_MAX_ATTEMPTS/,
  "Profile PIN verification must retain its persistent per-profile failure throttle.",
);
requireMatch(
  watchDetail,
  /WATCH_AUTOPLAY_PREFERENCE_KEY/,
  "Watch browser storage must be limited to an explicit autoplay presentation preference key.",
);
requireMatch(
  watchDetail,
  /function readAutoplayPreference\(\): boolean[\s\S]*?catch[\s\S]*?return true/,
  "Watch autoplay must safely default when browser storage is unavailable.",
);
requireMatch(
  watchDetail,
  /function persistAutoplayPreference[\s\S]*?catch/,
  "Watch autoplay persistence must not turn browser privacy controls into a page failure.",
);
forbidMatch(
  watchDetail,
  /localStorage\.(getItem|setItem)\([^\n]*(auth|session|profile|entitlement)/i,
  "Watch local storage must never hold authentication, profile, or entitlement state.",
);
requireMatch(
  themeStore,
  /function readThemeStorage[\s\S]*?catch[\s\S]*?return null/,
  "Theme storage reads must safely default when browser storage is unavailable.",
);
requireMatch(
  themeStore,
  /function writeThemeStorage[\s\S]*?catch/,
  "Theme storage writes must not turn browser privacy controls into a page failure.",
);
forbidMatch(
  themeStore,
  /localStorage\.(getItem|setItem)\([^\n]*(auth|session|profile|entitlement)/i,
  "Theme storage must never hold authentication, profile, or entitlement state.",
);
requireMatch(
  plisioLib,
  /function validatedPlisioApiBase/,
  "Plisio API base URLs must pass a dedicated server-side validation boundary.",
);
requireMatch(
  plisioLib,
  /endpoint\.protocol !== "https:"[\s\S]*?endpoint\.username[\s\S]*?endpoint\.password/,
  "Plisio API base URLs must require HTTPS and reject embedded credentials.",
);
requireMatch(
  plisioLib,
  /allowedPlisioApiHosts/,
  "Plisio API base URLs must be host allowlisted before secret-bearing requests.",
);
requireMatch(
  plisioLib,
  /function validatedInvoiceUrl/,
  "Provider invoice URLs must pass a dedicated server-side validation boundary.",
);
requireMatch(
  plisioLib,
  /invoiceUrl\.protocol !== "https:"/,
  "Provider invoice URLs must require HTTPS.",
);
requireMatch(
  plisioLib,
  /isAllowedInvoiceHost/,
  "Provider invoice URLs must be host allowlisted before client delivery.",
);
requireMatch(
  plisioLib,
  /invoiceUrl\.username \|\|[\s\S]*?invoiceUrl\.password/,
  "Provider invoice URLs must reject embedded user-info credentials.",
);
requireMatch(
  plisioLib,
  /invoiceUrl: validatedInvoiceUrl\(payload\.data\.invoice_url\)/,
  "Kryv checkout responses must use the validated provider invoice URL.",
);
requireMatch(
  renderBlueprint,
  /PLISIO_API_ALLOWED_HOSTS/,
  "Deployment configuration must declare the reviewed Plisio API host allowlist.",
);
requireMatch(
  renderBlueprint,
  /PLISIO_CHECKOUT_ALLOWED_HOSTS/,
  "Deployment configuration must declare the reviewed Plisio checkout host allowlist.",
);
forbidMatch(
  routeRegistry,
  /locationRouter/,
  "The unused third-party IP location proxy must not be mounted without a separately reviewed privacy design.",
);
requireMatch(
  worker,
  /function validatedAnalyticsWebhookUrl/,
  "Analytics webhook delivery must validate its configured endpoint before outbound requests.",
);
requireMatch(
  worker,
  /NODE_ENV === "production" && endpoint\.protocol !== "https:"/,
  "Production analytics webhook delivery must require HTTPS.",
);
requireMatch(
  worker,
  /redirect: "error"/,
  "Analytics webhook delivery must reject redirects rather than following an untrusted network hop.",
);
requireMatch(
  videosRoute,
  /parsed\.protocol === "https:" && !parsed\.username && !parsed\.password/,
  "Watch music-credit artwork and source links must require clean HTTPS authorities.",
);
requireMatch(
  videosRoute,
  /clean HTTPS URLs/,
  "Watch music-credit validation must clearly reject malformed or credential-bearing external URLs.",
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

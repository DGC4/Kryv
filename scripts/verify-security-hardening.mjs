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
  adReceiptDesign,
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
  videoSerializer,
  channelSerializer,
  adminRoute,
  adminDashboard,
  creatorProfileRoute,
  searchLib,
  ownerCinemaRoute,
  watchHome,
  creatorProfilePage,
  orvalNormalizer,
  watchIndexMigration,
  videosSchema,
  watchIndexValidation,
  fastpixLib,
  fastpixCspReview,
  cinemaCatalog,
  cinemaDiscussion,
  liveHome,
  liveViewerRefresh,
  creatorDirectory,
  liveCategoryPage,
  categoriesRoute,
  clipHome,
  clipDetail,
  notificationIndexMigration,
  notificationIndexValidation,
  header,
  webhooksRoute,
  notificationFanoutIndexMigration,
  notificationFanoutIndexValidation,
  followsSchema,
  notificationPreferenceIntegrityMigration,
  notificationPreferenceIntegrityValidation,
  streamingSchema,
  viewerDefaultIntegrityMigration,
  viewerDefaultIntegrityValidation,
  platformSchema,
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
  source("KRYV_AD_SIGNED_DELIVERY_RECEIPT_DESIGN.md"),
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
  source("artifacts/api-server/src/lib/videoSerializer.ts"),
  source("artifacts/api-server/src/lib/channelSerializer.ts"),
  source("artifacts/api-server/src/routes/admin.ts"),
  source("artifacts/blyze/src/pages/dashboard/Admin.tsx"),
  source("artifacts/api-server/src/routes/profiles.ts"),
  source("artifacts/api-server/src/lib/search.ts"),
  source("artifacts/api-server/src/routes/owner-cinema.ts"),
  source("artifacts/blyze/src/pages/watch/Home.tsx"),
  source("artifacts/blyze/src/pages/profile/CreatorProfile.tsx"),
  source("scripts/normalize-orval-react-query-options.mjs"),
  source("lib/db/drizzle/0024_watch_catalog_query_indexes.sql"),
  source("lib/db/src/schema/videos.ts"),
  source("KRYV_WATCH_CATALOG_INDEXES_NEON_VALIDATION.md"),
  source("artifacts/api-server/src/lib/fastpix.ts"),
  source("KRYV_FASTPIX_CSP_SCOPE_REVIEW.md"),
  source("artifacts/api-server/src/lib/cinemaCatalog.ts"),
  source("artifacts/blyze/src/components/discussion/CinemaDiscussion.tsx"),
  source("artifacts/blyze/src/pages/live/Home.tsx"),
  source("artifacts/api-server/src/lib/liveViewerRefresh.ts"),
  source("artifacts/blyze/src/pages/creators/Directory.tsx"),
  source("artifacts/blyze/src/pages/live/Category.tsx"),
  source("artifacts/api-server/src/routes/categories.ts"),
  source("artifacts/blyze/src/pages/clips/Home.tsx"),
  source("artifacts/blyze/src/pages/clips/Detail.tsx"),
  source("lib/db/drizzle/0025_notification_inbox_query_indexes.sql"),
  source("KRYV_NOTIFICATION_INBOX_INDEXES_NEON_VALIDATION.md"),
  source("artifacts/blyze/src/components/Header.tsx"),
  source("artifacts/api-server/src/routes/webhooks.ts"),
  source("lib/db/drizzle/0026_notification_fanout_query_indexes.sql"),
  source("KRYV_NOTIFICATION_FANOUT_INDEX_NEON_VALIDATION.md"),
  source("lib/db/src/schema/follows.ts"),
  source("lib/db/drizzle/0027_notification_preference_integrity.sql"),
  source("KRYV_NOTIFICATION_PREFERENCE_INTEGRITY_NEON_VALIDATION.md"),
  source("lib/db/src/schema/streaming.ts"),
  source("lib/db/drizzle/0028_viewer_profile_default_integrity.sql"),
  source("KRYV_VIEWER_PROFILE_DEFAULT_INTEGRITY_NEON_VALIDATION.md"),
  source("lib/db/src/schema/platform.ts"),
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
  cinemaHome,
  /profileButtonRefs[\s\S]*?moveProfileFocus[\s\S]*?ArrowLeft ArrowRight ArrowUp ArrowDown Home End/,
  "Cinema profile entry must retain directional remote focus controls for future TV navigation.",
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
  profileRoute,
  /MAX_VIEWER_PROFILES = 5[\s\S]*?listOrCreateDefaultViewerProfiles[\s\S]*?\.limit\(MAX_VIEWER_PROFILES\)/,
  "Viewer profile list hydration must remain bounded by the five-profile product limit.",
);
requireMatch(
  profileRoute,
  /listOrCreateDefaultViewerProfiles[\s\S]*?SELECT id FROM users WHERE id = \$\{userId\} FOR UPDATE[\s\S]*?currentProfiles[\s\S]*?\.insert\(viewerProfilesTable\)/,
  "Concurrent first visits must serialize default viewer-profile creation.",
);
requireMatch(
  profileRoute,
  /router\.post\("\/me\/profiles"[\s\S]*?SELECT id FROM users WHERE id = \$\{userId\} FOR UPDATE[\s\S]*?count\(\)[\s\S]*?MAX_VIEWER_PROFILES[\s\S]*?\.insert\(viewerProfilesTable\)/,
  "Viewer-profile creation must serialize the five-profile cap check and insert.",
);
requireMatch(
  apiSpec,
  /\/me\/profiles:[\s\S]*?type: array[\s\S]*?maxItems: 5[\s\S]*?ViewerProfile/,
  "The viewer-profile response contract must remain explicitly bounded to five profiles.",
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
  adReceiptDesign,
  /Advertising delivery remains hard-disabled[\s\S]*?has \*\*not\*\* been promoted to production/,
  "The signed receipt design must preserve hard-disabled delivery and no-production-promotion status.",
);
requireMatch(
  adReceiptDesign,
  /Browser events are untrusted telemetry[\s\S]*?must never directly create qualified delivery, bill a campaign, credit a creator, consume a frequency cap, or alter revenue allocation/,
  "Signed receipt design must prohibit client telemetry from directly affecting delivery accounting or frequency controls.",
);
requireMatch(
  adReceiptDesign,
  /intentionally not mapped into the active Drizzle application schema and no receipt route exists/,
  "Signed receipt design must preserve the no-active-schema-and-endpoint boundary before production promotion and launch approval.",
);
requireMatch(
  adReceiptDesign,
  /HMAC-SHA-256[\s\S]*?constant-time comparison/,
  "Signed receipt design must require versioned server-side HMAC verification with constant-time comparison.",
);
requireMatch(
  adReceiptDesign,
  /Required Reconciliation Separation[\s\S]*?Receipt issuance and browser requests do not update these records/,
  "Signed receipt design must keep impression, budget, creator balance, and revenue state behind separate reconciliation.",
);
requireMatch(
  adsRoute,
  /res\.setHeader\("Cache-Control", "private, no-store"\)/,
  "Advertising decisions must remain private and non-cacheable across viewers.",
);
requireMatch(
  adsRoute,
  /req\.activeProfileId !== profileId/,
  "Future profile-aware advertising decisions must require the session-bound active profile grant.",
);
requireMatch(
  adsRoute,
  /const userId = req\.user\?\.userId;[\s\S]*?if \(!userId\) \{[\s\S]*?viewer_identity_required_for_frequency_cap[\s\S]*?return;[\s\S]*?const \[consent\][\s\S]*?const \[adBreak\]/,
  "Anonymous advertising decisions must fail closed before consent, campaign, creative, or frequency-history work.",
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
  /profileMaturity !== "mature"[\s\S]*?eq\(channelsTable\.matureContent, false\)/,
  "Live discovery must omit mature channels at the database boundary without an eligible profile.",
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
  /profileMaturity !== "mature"[\s\S]*?eq\(channelsTable\.matureContent, false\)[\s\S]*?\.limit\(query\.data\.limit\)[\s\S]*?\.offset\(query\.data\.offset\)[\s\S]*?total: countRows\[0\]\?\.total/,
  "Live clip discovery must apply maturity visibility before bounded generated page queries and report a profile-visible total.",
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
  /const channelVisibilityCondition =[\s\S]*?eq\(channelsTable\.matureContent, false\)[\s\S]*?\.where\(and\([\s\S]*?channelVisibilityCondition[\s\S]*?\.limit\(8\)/,
  "Live search must apply profile maturity visibility in SQL before its bounded channel result limit.",
);
requireMatch(
  discoverRoute,
  /eq\(clipsTable\.processingStatus, "ready"\)[\s\S]*?channelVisibilityCondition[\s\S]*?\.limit\(8\)/,
  "Clip search must apply profile maturity visibility in SQL before its bounded result limit.",
);
forbidMatch(
  discoverRoute,
  /const visibleChannels = channels\.filter|const visibleClips = clips\.filter/,
  "Discover search must not consume bounded channel or Clip capacity before post-query maturity filtering.",
);
requireMatch(
  discoverRoute,
  /eq\(videosTable\.contentType, "upload"\)[\s\S]*?eq\(videosTable\.uploadStatus, "ready"\)/,
  "Unified Watch search must contain only ready public upload inventory rather than Cinema records.",
);
requireMatch(
  discoverRoute,
  /router\.get\("\/me\/followed\/live"[\s\S]*?getActiveProfileMaturity\(req\)[\s\S]*?eq\(channelsTable\.isLive, true\)[\s\S]*?profileMaturity === "mature" \? undefined : eq\(channelsTable\.matureContent, false\)[\s\S]*?\.limit\(50\)[\s\S]*?toChannelSummaries\(rows/,
  "Followed Live must apply profile maturity visibility in SQL before its bounded result limit.",
);
requireMatch(
  meRoute,
  /const MAX_ACCOUNT_SUMMARY_FOLLOWED_CHANNELS = 50[\s\S]*?getActiveProfileMaturity\(req\)[\s\S]*?profileMaturity === "mature"[\s\S]*?eq\(channelsTable\.matureContent, false\)[\s\S]*?orderBy\(desc\(followsTable\.createdAt\), desc\(followsTable\.id\)\)[\s\S]*?\.limit\(MAX_ACCOUNT_SUMMARY_FOLLOWED_CHANNELS\)[\s\S]*?toChannelSummaries\([\s\S]*?followedRows\.map/,
  "Account-summary followed channels must apply profile maturity in SQL before stable bounded retrieval and batched hydration.",
);
requireMatch(
  apiSpec,
  /Me:[\s\S]*?followedChannels:[\s\S]*?type: array[\s\S]*?maxItems: 50[\s\S]*?ChannelSummary/,
  "Account-summary followed channels must retain an explicit 50-item response contract cap.",
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
  "Profile PIN security operations must have a dedicated shared rate-limit namespace.",
);
requireMatch(
  appServer,
  /kryv:rate:search:/,
  "Public search must have a dedicated shared rate-limit namespace.",
);
requireMatch(
  appServer,
  /app\.use\("\/api\/search", searchLimiter\);/,
  "Public search must be mounted behind its dedicated rate limiter.",
);
requireMatch(
  appServer,
  /kryv:rate:ad-decision:/,
  "Advertising decisions must retain a dedicated shared rate-limit namespace before delivery launch.",
);
requireMatch(
  appServer,
  /app\.use\("\/api\/ads\/decision", adDecisionLimiter\);/,
  "Advertising decision evaluation must be narrowly mounted behind its dedicated rate limiter.",
);
requireMatch(
  appServer,
  /kryv:rate:safety-report:/,
  "Safety-report submissions must have a dedicated shared rate-limit namespace.",
);
requireMatch(
  appServer,
  /app\.use\("\/api\/channels"[\s\S]*?\(reports\|channel-reports\)[\s\S]*?safetyReportLimiter/,
  "Live safety-report limiter must be narrowly mounted for chat and channel report submissions.",
);
requireMatch(
  appServer,
  /app\.use\("\/api\/clips"[\s\S]*?reports[\s\S]*?safetyReportLimiter[\s\S]*?app\.use\("\/api\/videos"[\s\S]*?reports[\s\S]*?safetyReportLimiter/,
  "Clip and Watch safety-report submissions must share the dedicated limiter.",
);
requireMatch(
  appServer,
  /kryv:rate:cinema-discussion:/,
  "Cinema discussion writes must have a dedicated shared rate-limit namespace.",
);
requireMatch(
  appServer,
  /app\.use\("\/api\/cinema\/titles"[\s\S]*?req\.method === "POST"[\s\S]*?req\.method === "DELETE"[\s\S]*?cinemaDiscussionLimiter/,
  "Cinema discussion action limiting must be narrowly scoped to comment writes and removals.",
);
requireMatch(
  searchLib,
  /value\.replace\(\/\[\\\\%_\]\/g, "\\\\\$&"\)/,
  "Literal search patterns must escape PostgreSQL ILIKE wildcard metacharacters.",
);
requireMatch(
  videosRoute,
  /literalIlikePattern\(query\.data\.search\.trim\(\)\)/,
  "Watch browse search must use the shared literal ILIKE pattern.",
);
requireMatch(
  discoverRoute,
  /const pattern = literalIlikePattern\(term\)/,
  "Unified Discover search must use the shared literal ILIKE pattern.",
);
requireMatch(
  discoverRoute,
  /refreshLiveChannelViewerCounts\(\s*persistedLiveChannels/,
  "Discover must use the shared bounded FastPix viewer-refresh helper.",
);
requireMatch(
  discoverRoute,
  /let discoverSummaryRefresh:[\s\S]*?if \(!discoverSummaryRefresh\)[\s\S]*?\.finally\(\(\) => \{[\s\S]*?discoverSummaryRefresh = null/,
  "Discover cache misses must coalesce into one in-process refresh and clear reliably after completion.",
);
requireMatch(
  liveViewerRefresh,
  /LIVE_VIEWER_REFRESH_CONCURRENCY = 12/,
  "Live viewer refresh must cap concurrent FastPix requests at a bounded worker count.",
);
requireMatch(
  liveViewerRefresh,
  /Array\.from\([\s\S]*?Math\.min\(LIVE_VIEWER_REFRESH_CONCURRENCY, channels\.length\)/,
  "Shared live viewer refresh must use a bounded worker pool rather than one provider request per channel at once.",
);
requireMatch(
  discoverRoute,
  /where\(eq\(categoriesTable\.kind, "live_game"\)\)[\s\S]*?filter\(\(category\) => category\.liveChannelCount > 0\)[\s\S]*?right\.viewerCount - left\.viewerCount/,
  "Discover top categories must be active Live categories ranked by audience rather than an arbitrary table slice.",
);
requireMatch(
  apiSpec,
  /\/channels:[\s\S]*?name: limit[\s\S]*?maximum: 100[\s\S]*?default: 48[\s\S]*?name: offset[\s\S]*?\$ref: "#\/components\/schemas\/ChannelPage"/,
  "Channel directory must expose a typed bounded page contract.",
);
requireMatch(
  liveChannelRoute,
  /const conditions: SQL\[\] = \[\][\s\S]*?literalIlikePattern\(search\)[\s\S]*?profileMaturity !== "mature"[\s\S]*?eq\(channelsTable\.matureContent, false\)[\s\S]*?\.limit\(query\.data\.limit\)[\s\S]*?\.offset\(query\.data\.offset\)[\s\S]*?refreshLiveChannelViewerCounts\(rows\)[\s\S]*?total: countRows\[0\]\?\.total/,
  "Channel directory must apply maturity visibility before bounded SQL paging, count only visible channels, and use the shared viewer refresh helper.",
);
requireMatch(
  creatorDirectory,
  /channelsPage\?\.items[\s\S]*?channelOffset[\s\S]*?More creators/,
  "Creator directory must consume the bounded channel page and expose explicit continuation controls.",
);
requireMatch(
  liveCategoryPage,
  /limit: 48[\s\S]*?channelsPage\?\.items/,
  "Live category pages must consume a bounded channel page rather than an unbounded array response.",
);
requireMatch(
  categoriesRoute,
  /COUNT\(\$\{channelsTable\.id\}\)[\s\S]*?COALESCE\(SUM\(\$\{channelsTable\.viewerCount\}\), 0\)[\s\S]*?leftJoin\(channelsTable, visibleLiveChannelJoin\)/,
  "Category summaries must use one grouped Live aggregation rather than per-category count and viewer queries.",
);
requireMatch(
  categoriesRoute,
  /profileMaturity === "mature"[\s\S]*?eq\(channelsTable\.matureContent, false\)/,
  "Category summaries must exclude mature Live inventory unless the active profile is mature.",
);
requireMatch(
  categoriesRoute,
  /visibilityScope =[\s\S]*?profileMaturity === "mature" \? "mature" : "restricted"[\s\S]*?kryv:categories:[\s\S]*?readSharedJson[\s\S]*?writeSharedJson\(cacheKey, response, CATEGORY_SUMMARY_CACHE_TTL_SECONDS\)/,
  "Category cache keys must separate mature and restricted inventories while retaining a short shared aggregate cache.",
);
requireMatch(
  apiSpec,
  /\/clips:[\s\S]*?name: limit[\s\S]*?maximum: 100[\s\S]*?default: 48[\s\S]*?name: offset[\s\S]*?\$ref: "#\/components\/schemas\/ClipPage"/,
  "Clip catalog must expose a typed bounded page contract.",
);
requireMatch(
  liveClipsRoute,
  /ListClipsQueryParams[\s\S]*?profileMaturity !== "mature"[\s\S]*?eq\(channelsTable\.matureContent, false\)[\s\S]*?\.limit\(query\.data\.limit\)[\s\S]*?\.offset\(query\.data\.offset\)[\s\S]*?total: countRows\[0\]\?\.total/,
  "Clip catalog must apply maturity visibility before bounded SQL paging and return a total visible to the active profile.",
);
requireMatch(
  clipHome,
  /clipsPage\?\.items[\s\S]*?clipOffset[\s\S]*?Older clips/,
  "Clip home must consume the bounded Clip page and expose explicit continuation controls.",
);
requireMatch(
  clipDetail,
  /limit: 12[\s\S]*?channelClipsPage\?\.items/,
  "Clip detail must use a compact bounded page for same-creator recommendations.",
);
requireMatch(
  channelPage,
  /limit: 24[\s\S]*?liveRailPage\?\.items/,
  "Channel detail related-live rail must consume a compact bounded channel page.",
);
requireMatch(
  adminRoute,
  /literalIlikePattern\(query\)/,
  "Owner user and channel searches must use literal ILIKE patterns.",
);
requireMatch(
  adminRoute,
  /literalIlikePattern\(q\)/,
  "Owner Watch video search must use a literal ILIKE pattern.",
);
requireMatch(
  adminRoute,
  /OPERATIONAL_FEATURE_FLAG_KEYS = Object\.keys\(OPERATIONAL_FLAG_COPY\)[\s\S]*?MAX_ADMIN_OPERATIONAL_FEATURE_FLAGS = OPERATIONAL_FEATURE_FLAG_KEYS\.length[\s\S]*?\/admin\/feature-flags[\s\S]*?inArray\(featureFlagsTable\.key, OPERATIONAL_FEATURE_FLAG_KEYS\)[\s\S]*?\.limit\(MAX_ADMIN_OPERATIONAL_FEATURE_FLAGS\)/,
  "Owner feature-flag listing must query only the explicitly declared, bounded operational control set.",
);
requireMatch(
  ownerCinemaRoute,
  /literalIlikePattern\(q\)/,
  "Owner Cinema title search must use a literal ILIKE pattern.",
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
  plisioLib,
  /currencies\/USD[\s\S]*?redirect: "error"[\s\S]*?\/balances\/[\s\S]*?redirect: "error"[\s\S]*?shops\/deposit\/new[\s\S]*?redirect: "error"[\s\S]*?operations\/withdraw[\s\S]*?redirect: "error"[\s\S]*?operations\/commission[\s\S]*?redirect: "error"[\s\S]*?invoices\/new[\s\S]*?redirect: "error"/,
  "Every secret-bearing Plisio API transport must reject redirects rather than forwarding provider credentials to an untrusted hop.",
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
  videoSerializer,
  /MAX_VIDEO_MUSIC_CREDITS = 20[\s\S]*?videoMusicCreditsTable[\s\S]*?\.orderBy\(asc\(videoMusicCreditsTable\.displayOrder\), asc\(videoMusicCreditsTable\.createdAt\)\)[\s\S]*?\.limit\(MAX_VIDEO_MUSIC_CREDITS\)/,
  "Public Watch detail must retain the shared bounded music-credit hydration query.",
);
requireMatch(
  videosRoute,
  /MAX_VIDEO_MUSIC_CREDITS[\s\S]*?orderBy\(videoMusicCreditsTable\.displayOrder, videoMusicCreditsTable\.createdAt\)[\s\S]*?\.limit\(MAX_VIDEO_MUSIC_CREDITS\)/,
  "Owner Watch music-credit retrieval must use the shared bounded display query.",
);
requireMatch(
  apiSpec,
  /\/videos\/\{id\}\/music-credits:[\s\S]*?type: array[\s\S]*?maxItems: 20[\s\S]*?VideoMusicCredit[\s\S]*?musicCredits:[\s\S]*?type: array[\s\S]*?maxItems: 20/,
  "Watch credit list and detail contracts must explicitly cap music-credit responses at 20 items.",
);
requireMatch(
  videosRoute,
  /SELECT id FROM videos WHERE id = \$\{video\.id\} FOR UPDATE[\s\S]*?count\(\)[\s\S]*?MAX_VIDEO_MUSIC_CREDITS[\s\S]*?\.insert\(videoMusicCreditsTable\)/,
  "Watch music-credit creation must serialize per-video cap checks with its insert.",
);
requireMatch(
  videosRoute,
  /\.innerJoin\(channelsTable, eq\(channelsTable\.id, videosTable\.channelId\)\)/,
  "Watch browse must hydrate channel summaries through a database join rather than per-video queries.",
);
requireMatch(
  videosRoute,
  /\.leftJoin\(categoriesTable, eq\(categoriesTable\.id, videosTable\.categoryId\)\)/,
  "Watch browse must hydrate category names through a database join rather than per-video queries.",
);
requireMatch(
  videosRoute,
  /ilike\(videosTable\.title, literalIlikePattern/,
  "Watch search must run as a database-side literal case-insensitive filter.",
);
requireMatch(
  videosRoute,
  /toVideoSummaryFromRelations/,
  "Watch browse must use the batched relation-aware serializer.",
);
requireMatch(
  videoSerializer,
  /export function toVideoSummaryFromRelations/,
  "The relation-aware Watch summary serializer must remain available for batched browse results.",
);
requireMatch(
  liveChannelRoute,
  /toChannelSummaries\(rows\)/,
  "The primary Live directory must use the batched channel summary path.",
);
requireMatch(
  channelSerializer,
  /export async function toChannelSummaries/,
  "The batched Live channel summary helper must remain available for directory-scale hydration.",
);
requireMatch(
  channelSerializer,
  /groupBy\(followsTable\.channelId\)/,
  "Live summary follower counts must aggregate by channel in the database.",
);
requireMatch(
  channelSerializer,
  /groupBy\(subscriptionsTable\.channelId\)/,
  "Live summary active-subscriber counts must aggregate by channel in the database.",
);
requireMatch(
  channelSerializer,
  /inArray\(categoriesTable\.id, categoryIds\)/,
  "Live summary category names must be hydrated in one bounded database query.",
);
requireMatch(
  discoverRoute,
  /toChannelSummaries\([\s\S]*?visibleLiveChannels\.slice\(0, 8\)/,
  "Discover featured Live channels must use the batched summary path.",
);
requireMatch(
  discoverRoute,
  /channels: await toChannelSummaries\(channels\)/,
  "Discover search Live results must use the batched summary path after SQL-side profile filtering.",
);
requireMatch(
  discoverRoute,
  /toVideoSummaryFromRelations\(row\.video, row\.channel, row\.categoryName\)/,
  "Discover search Watch results must use joined relation-aware summaries.",
);
requireMatch(
  discoverRoute,
  /toChannelSummaries\(rows\.map\(\(\{ channel \}\) => channel\)\)/,
  "Followed-live discovery must use the batched summary path after SQL-side profile filtering.",
);
requireMatch(
  meRoute,
  /const followedChannels = await toChannelSummaries\(/,
  "Authenticated account followed channels must use the batched summary path.",
);
requireMatch(
  adminRoute,
  /channels: await toChannelSummaries\(channels\)/,
  "Admin user activity channel summaries must use the batched path.",
);
requireMatch(
  adminRoute,
  /const results = await toChannelSummaries\(rows\)/,
  "Admin channel directory summaries must use the batched path.",
);
requireMatch(
  adminRoute,
  /toVideoSummaryFromRelations\(video, channel, categoryName\)/,
  "Admin video directory results must use joined relation-aware summaries.",
);
requireMatch(
  creatorProfileRoute,
  /select\(\{ video: videosTable, categoryName: categoriesTable\.name \}\)/,
  "Creator profile Watch rails must join category names in their bounded query.",
);
requireMatch(
  creatorProfileRoute,
  /toVideoSummaryFromRelations\(video, channel, categoryName\)/,
  "Creator profile Watch rails must use the already-loaded channel summary relation.",
);
requireMatch(
  videoSerializer,
  /relations\?: VideoDetailRelations/,
  "Watch detail serialization must accept already-hydrated channel and category relations.",
);
requireMatch(
  videosRoute,
  /categoryName: categoriesTable\.name/,
  "Watch detail retrieval must join its category name alongside the authorized channel.",
);
requireMatch(
  videosRoute,
  /toVideoDetail\(video, viewerUserId, \{[\s\S]*?channel: row\.channel,[\s\S]*?categoryName: row\.categoryName/,
  "Watch detail must reuse its joined channel and category relations when serializing.",
);
requireMatch(
  videosRoute,
  /router\.post\("\/videos\/:id\/provider-status"[\s\S]*?categoryName: categoriesTable\.name[\s\S]*?toVideoDetail\(updated, req\.user!\.userId, \{ channel, categoryName \}\)/,
  "FastPix Watch-status refresh must reuse its joined channel and category relations when serializing.",
);
requireMatch(
  videosRoute,
  /router\.patch\("\/videos\/:id"[\s\S]*?categoryName: categoriesTable\.name[\s\S]*?toVideoDetail\(updated, userId, \{ channel, categoryName \}\)/,
  "Authorized Watch updates must reuse their joined channel and category relations when serializing.",
);
requireMatch(
  apiSpec,
  /name: limit[\s\S]*?maximum: 100[\s\S]*?default: 48[\s\S]*?name: offset/,
  "Watch browse must expose bounded typed limit and offset query controls.",
);
requireMatch(
  apiSpec,
  /VideoPage:[\s\S]*?required: \[items, total, limit, offset\]/,
  "Watch browse must return a typed bounded page with total metadata.",
);
requireMatch(
  videosRoute,
  /\.orderBy\(desc\(videosTable\.createdAt\), desc\(videosTable\.id\)\)[\s\S]*?\.limit\(query\.data\.limit\)[\s\S]*?\.offset\(query\.data\.offset\)/,
  "Watch browse must enforce stable bounded database pagination.",
);
requireMatch(
  videosRoute,
  /select\(\{ total: sql<number>`count\(\*\)`\.mapWith\(Number\) \}\)[\s\S]*?ListVideosResponse\.parse\(\{[\s\S]*?total: countRows\[0\]\?\.total/,
  "Watch browse must return authoritative total metadata alongside its bounded page.",
);
requireMatch(
  creatorProfileRoute,
  /\.orderBy\(desc\(videosTable\.createdAt\), desc\(videosTable\.id\)\)[\s\S]*?\.limit\(48\)/,
  "Creator profile Watch rails must cap initial media hydration to 48 newest releases.",
);
requireMatch(
  creatorProfileRoute,
  /watchTotal: watchCountRows\[0\]\?\.total/,
  "Creator profile responses must disclose the full ready Watch release count.",
);
requireMatch(
  watchHome,
  /channelId: creatorChannelId/,
  "Watch home must accept the creator-profile channel filter in its bounded browse query.",
);
requireMatch(
  watchHome,
  /categoryButtonRefs[\s\S]*?moveCategoryFocus[\s\S]*?ArrowLeft ArrowRight Home End/,
  "Watch categories must retain roving directional focus controls for keyboard and future remote navigation.",
);
requireMatch(
  watchHome,
  /WATCH_PAGE_SIZE = 48[\s\S]*?limit: WATCH_PAGE_SIZE[\s\S]*?offset: videoOffset[\s\S]*?videoPage\?\.items[\s\S]*?Older releases/,
  "Watch home must consume the bounded VideoPage and expose explicit catalog continuation controls.",
);
requireMatch(
  apiSpec,
  /\/admin\/moderation\/cases:[\s\S]*?name: limit[\s\S]*?maximum: 100[\s\S]*?name: offset[\s\S]*?AdminModerationCasePage/,
  "Owner moderation cases must expose a bounded typed page contract with validated limit and offset controls.",
);
requireMatch(
  adminRoute,
  /const moderationFilter[\s\S]*?select\(\{ total: count\(\) \}\)[\s\S]*?where\(moderationFilter\)[\s\S]*?orderBy\(desc\(moderationCasesTable\.createdAt\), desc\(moderationCasesTable\.id\)\)[\s\S]*?limit\(query\.data\.limit\)[\s\S]*?offset\(query\.data\.offset\)[\s\S]*?total: totalRows\[0\]\?\.total/,
  "Owner moderation SQL must filter before authoritative count and stable bounded page retrieval.",
);
requireMatch(
  adminDashboard,
  /useListAdminModerationCases\(\{ status: 'open', limit: 50, offset: moderationOffset \}[\s\S]*?data\?\.items[\s\S]*?Older cases/,
  "Owner safety dashboard must consume moderation page items and expose explicit newer/older continuation controls.",
);
requireMatch(
  adminDashboard,
  /const reviewModerationCase[\s\S]*?items\.length[\s\S]*?setModerationOffset/,
  "Owner safety dashboard must recover to a valid preceding page when a final review removes the last later-page case.",
);
requireMatch(
  apiSpec,
  /\/admin\/finance\/payout-profiles:[\s\S]*?name: limit[\s\S]*?name: offset[\s\S]*?AdminPayoutProfilePage[\s\S]*?\/admin\/finance\/payout-requests:[\s\S]*?name: limit[\s\S]*?name: offset[\s\S]*?AdminPayoutRequestPage/,
  "Owner payout profile and request endpoints must expose bounded typed page contracts.",
);
requireMatch(
  adminRoute,
  /payout-profiles[\s\S]*?ListAdminPayoutProfilesQueryParams[\s\S]*?supportedKryvCryptoCodes\(\)[\s\S]*?total: totalRows\[0\]\?\.total[\s\S]*?payout-requests[\s\S]*?ListAdminPayoutRequestsQueryParams[\s\S]*?supportedKryvCryptoCodes\(\)[\s\S]*?total: totalRows\[0\]\?\.total/,
  "Owner payout SQL must filter approved currencies before authoritative totals and bounded page retrieval.",
);
requireMatch(
  adminDashboard,
  /payoutProfileOffset[\s\S]*?useListAdminPayoutProfiles\(\{ limit: 50, offset: payoutProfileOffset \}[\s\S]*?Older profiles/,
  "Owner finance dashboard must consume payout profile pages with explicit continuation controls.",
);
requireMatch(
  adminDashboard,
  /payoutRequestOffset[\s\S]*?useListAdminPayoutRequests\(\{ limit: 50, offset: payoutRequestOffset \}[\s\S]*?Older requests/,
  "Owner finance dashboard must consume payout request pages with explicit continuation controls.",
);
requireMatch(
  apiSpec,
  /\/videos\/\{id\}\/comments:[\s\S]*?name: limit[\s\S]*?maximum: 50[\s\S]*?name: offset[\s\S]*?VideoCommentPage/,
  "Watch discussion must expose a bounded parent-comment page contract.",
);
requireMatch(
  videosRoute,
  /visibleParentFilter[\s\S]*?isNull\(videoCommentsTable\.parentCommentId\)[\s\S]*?select\(\{ total: count\(\) \}\)[\s\S]*?limit\(query\.data\.limit\)[\s\S]*?offset\(query\.data\.offset\)[\s\S]*?inArray\(videoCommentsTable\.parentCommentId, parentIds\)[\s\S]*?total: totalRows\[0\]\?\.total/,
  "Watch discussion SQL must page visible parent threads before bounded reply hydration and return an authoritative parent total.",
);
requireMatch(
  watchDetail,
  /commentOffset[\s\S]*?useListVideoComments\(videoId, \{ limit: 25, offset: commentOffset \}[\s\S]*?setCommentOffset\(0\)[\s\S]*?Older comments/,
  "Watch detail must consume the bounded discussion page, reset mutations to newest, and expose thread continuation controls.",
);
requireMatch(
  apiSpec,
  /\/admin\/finance\/creator-balances:[\s\S]*?name: limit[\s\S]*?maximum: 100[\s\S]*?name: offset[\s\S]*?AdminCreatorBalancePage/,
  "Owner creator balances must expose a bounded typed page contract.",
);
requireMatch(
  adminRoute,
  /creator-balances[\s\S]*?ListAdminCreatorBalancesQueryParams[\s\S]*?select\(\{ total: count\(\) \}\)[\s\S]*?limit\(query\.data\.limit\)[\s\S]*?offset\(query\.data\.offset\)[\s\S]*?total: totalRows\[0\]\?\.total/,
  "Owner creator-balance SQL must return an authoritative stable bounded page.",
);
requireMatch(
  adminDashboard,
  /creatorBalanceOffset[\s\S]*?useListAdminCreatorBalances\(\{ limit: 50, offset: creatorBalanceOffset \}[\s\S]*?Older assets/,
  "Owner finance dashboard must consume creator-balance pages with explicit continuation controls.",
);
requireMatch(
  adminDashboard,
  /useListAdminChannels\([\s\S]*?limit: 30, offset: adminChannelOffset[\s\S]*?channelRegistryQuery\.data\.total[\s\S]*?setAdminChannelOffset\(adminChannelOffset \+ 30\)/,
  "Owner channel registry must consume its bounded page total and expose forward continuation.",
);
requireMatch(
  adminDashboard,
  /useListAdminVideos\([\s\S]*?limit: 30, offset: adminVideoOffset[\s\S]*?videoRegistryQuery\.data\.total[\s\S]*?setAdminVideoOffset\(adminVideoOffset \+ 30\)/,
  "Owner Watch registry must consume its bounded page total and expose forward continuation.",
);
requireMatch(
  adminDashboard,
  /const removeChannel[\s\S]*?channelRegistryQuery\.data\?\.items\.length === 1[\s\S]*?setAdminChannelOffset\(Math\.max\(0, adminChannelOffset - 30\)\)[\s\S]*?const removeVideo[\s\S]*?videoRegistryQuery\.data\?\.items\.length === 1[\s\S]*?setAdminVideoOffset\(Math\.max\(0, adminVideoOffset - 30\)\)/,
  "Owner channel and Watch deletion must recover from an empty final later page after a successful removal.",
);
requireMatch(
  watchHome,
  /const selectCategoryAt[\s\S]*?setVideoOffset\(0\)[\s\S]*?const submitSearch[\s\S]*?setVideoOffset\(0\)[\s\S]*?const clearFilters[\s\S]*?setVideoOffset\(0\)/,
  "Watch home must reset pagination whenever category, search, or clear-filter state changes.",
);
requireMatch(
  creatorProfilePage,
  /watchTotal > watch\.length[\s\S]*?\/watch\?channelId=\$\{channel\.id\}/,
  "Creator profiles must make capped Watch rails explicit and link to their complete filtered catalog.",
);
requireMatch(
  orvalNormalizer,
  /validatorNames[\s\S]*?collidingTypeModules/,
  "Contract generation must discover and normalize colliding Zod validator and model exports.",
);
requireMatch(
  watchIndexMigration,
  /videos_ready_upload_created_idx[\s\S]*?created_at DESC, id DESC[\s\S]*?content_type = 'upload'[\s\S]*?upload_status = 'ready'/,
  "Production-pending Watch indexing must cover ready public newest-first pages.",
);
requireMatch(
  watchIndexMigration,
  /videos_watch_channel_created_idx[\s\S]*?channel_id, created_at DESC, id DESC[\s\S]*?content_type = 'upload'/,
  "Production-pending Watch indexing must cover creator-scoped newest-first libraries.",
);
requireMatch(
  watchIndexMigration,
  /CREATE INDEX CONCURRENTLY IF NOT EXISTS videos_ready_upload_created_idx[\s\S]*?CREATE INDEX CONCURRENTLY IF NOT EXISTS videos_watch_channel_created_idx/,
  "Production-pending Watch indexes must use concurrent independently executed creation statements.",
);
requireMatch(
  videosSchema,
  /watchReadyCatalogIdx: index\("videos_ready_upload_created_idx"\)/,
  "Drizzle video metadata must retain the ready public Watch index.",
);
requireMatch(
  videosSchema,
  /watchChannelCatalogIdx: index\("videos_watch_channel_created_idx"\)/,
  "Drizzle video metadata must retain the creator-scoped Watch index.",
);
requireMatch(
  watchIndexValidation,
  /br-blue-union-a6uq3yjr[\s\S]*?CREATE INDEX CONCURRENTLY IF NOT EXISTS/,
  "Watch index validation must record the fresh isolated concurrent-build evidence.",
);
requireMatch(
  watchIndexValidation,
  /Production-pending[\s\S]*?No production schema change was performed/,
  "Watch index validation evidence must keep the production rollout explicitly pending.",
);
requireMatch(
  apiSpec,
  /\/me\/notifications:[\s\S]*?name: limit[\s\S]*?maximum: 30[\s\S]*?name: offset[\s\S]*?minimum: 0[\s\S]*?NotificationInbox:[\s\S]*?required: \[items, unreadCount, total, limit, offset\]/,
  "Notification inbox must expose a typed bounded continuation contract with total metadata.",
);
requireMatch(
  meRoute,
  /router\.get\([\s\S]*?"\/me\/notifications"[\s\S]*?orderBy\(desc\(notificationsTable\.createdAt\), desc\(notificationsTable\.id\)\)[\s\S]*?\.limit\(query\.data\.limit\)[\s\S]*?\.offset\(query\.data\.offset\)[\s\S]*?total: Number\(total\?\.count \?\? 0\)/,
  "Notification inbox must use stable user-scoped bounded SQL paging and return an authoritative total.",
);
requireMatch(
  header,
  /notificationOffset[\s\S]*?useGetNotificationInbox\(\{ limit: 12, offset: notificationOffset \}[\s\S]*?notificationInbox\.data\.total[\s\S]*?Newer[\s\S]*?Older/,
  "Notification bell must consume the bounded inbox page and expose newer and older continuation controls.",
);
requireMatch(
  webhooksRoute,
  /NOTIFICATION_FANOUT_BATCH_SIZE = 500[\s\S]*?gt\(followsTable\.id, lastFollowId\)[\s\S]*?orderBy\(asc\(followsTable\.id\)\)[\s\S]*?\.limit\(NOTIFICATION_FANOUT_BATCH_SIZE\)[\s\S]*?await process/,
  "Webhook notification fan-out must use bounded keyset recipient batches rather than an unbounded follower read.",
);
requireMatch(
  webhooksRoute,
  /createFollowedLiveNotifications[\s\S]*?forEachFollowedRecipientBatch[\s\S]*?inArray\(notificationPreferencesTable\.userId, followerIds\)[\s\S]*?createFollowedContentNotifications[\s\S]*?forEachFollowedRecipientBatch[\s\S]*?inArray\(notificationPreferencesTable\.userId, followerIds\)/,
  "Live and Watch/Clip followed-content notifications must evaluate preferences and insert within each bounded recipient batch.",
);
requireMatch(
  notificationIndexMigration,
  /CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_created_idx[\s\S]*?user_id, created_at DESC, id DESC[\s\S]*?CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_unread_user_idx[\s\S]*?WHERE is_read = false/,
  "Production-pending notification inbox indexes must use concurrent independently executed ordering and unread-count statements.",
);
requireMatch(
  notificationIndexValidation,
  /VALIDATED ON AN ISOLATED NEON BRANCH ONLY[\s\S]*?br-lucky-wind-a6ik3vpo/,
  "Notification index validation must record isolated-branch evidence.",
);
requireMatch(
  notificationIndexValidation,
  /No production promotion has occurred[\s\S]*?no production promotion is authorized/,
  "Notification index validation evidence must explicitly prohibit unapproved production promotion.",
);
requireMatch(
  notificationIndexValidation,
  /must run outside a transaction/,
  "Notification index validation must preserve the out-of-transaction concurrent-index operational boundary.",
);
requireMatch(
  notificationFanoutIndexMigration,
  /CREATE INDEX CONCURRENTLY IF NOT EXISTS follows_channel_id_idx[\s\S]*?channel_id, id/,
  "Production-pending fan-out indexing must support the channel-scoped keyset recipient cursor.",
);
requireMatch(
  followsSchema,
  /channelFanoutIdx: index\("follows_channel_id_idx"\)\.on\(table\.channelId, table\.id\)/,
  "Drizzle follow metadata must retain the notification fan-out keyset index.",
);
requireMatch(
  notificationFanoutIndexValidation,
  /VALIDATED ON AN ISOLATED NEON BRANCH ONLY[\s\S]*?br-lingering-rice-a6fszepe[\s\S]*?must run outside a transaction/,
  "Fan-out index validation must record fresh isolated concurrent-build evidence and the operational boundary.",
);
requireMatch(
  notificationFanoutIndexValidation,
  /No production promotion has occurred[\s\S]*?no production promotion is authorized/,
  "Fan-out index validation evidence must explicitly prohibit unapproved production promotion.",
);
requireMatch(
  meRoute,
  /router\.put\([\s\S]*?"\/me\/notification-preferences"[\s\S]*?SELECT id FROM users WHERE id = \$\{userId\} FOR UPDATE[\s\S]*?isNull\(notificationPreferencesTable\.channelId\)[\s\S]*?\.insert\(notificationPreferencesTable\)[\s\S]*?action: "notification_preferences_updated"[\s\S]*?sessionId: req\.user!\.sessionId \?\? null/,
  "Global notification-preference mutations must serialize the empty-row check and insert, then preserve an auditable session-bound record.",
);
requireMatch(
  notificationPreferenceIntegrityMigration,
  /CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS notification_preferences_global_user_unique[\s\S]*?user_id[\s\S]*?WHERE channel_id IS NULL/,
  "Production-pending notification-preference integrity must use a concurrent partial unique index.",
);
requireMatch(
  streamingSchema,
  /globalUserUnique: uniqueIndex\("notification_preferences_global_user_unique"\)[\s\S]*?\.on\(table\.userId\)[\s\S]*?\.where\(isNull\(table\.channelId\)\)/,
  "Drizzle notification-preference metadata must retain the global partial unique index.",
);
requireMatch(
  notificationPreferenceIntegrityValidation,
  /zero rows[\s\S]*?notification_preferences_global_user_unique[\s\S]*?must run outside a transaction/,
  "Notification-preference index validation must record duplicate preflight and the concurrent-build boundary.",
);
requireMatch(
  notificationPreferenceIntegrityValidation,
  /No production promotion has occurred[\s\S]*?no production promotion is authorized/,
  "Notification-preference validation evidence must explicitly prohibit unapproved production promotion.",
);
requireMatch(
  profileRoute,
  /router\.patch\([\s\S]*?"\/me\/profiles\/:id"[\s\S]*?SELECT id FROM users WHERE id = \$\{userId\} FOR UPDATE[\s\S]*?existing\.isDefault && parsed\.data\.isDefault === false[\s\S]*?parsed\.data\.isDefault === true[\s\S]*?isDefault: false/,
  "Viewer-profile default reassignment must revalidate and serialize profile state inside the account lock.",
);
requireMatch(
  profileRoute,
  /router\.delete\([\s\S]*?"\/me\/profiles\/:id"[\s\S]*?SELECT id FROM users WHERE id = \$\{userId\} FOR UPDATE[\s\S]*?profile\.isDefault[\s\S]*?\.delete\(viewerProfilesTable\)/,
  "Viewer-profile deletion must revalidate default state inside the shared account lock before removal.",
);
requireMatch(
  viewerDefaultIntegrityMigration,
  /CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS viewer_profiles_default_user_unique[\s\S]*?user_id[\s\S]*?WHERE is_default = true/,
  "Production-pending viewer-default integrity must use a concurrent partial unique index.",
);
requireMatch(
  platformSchema,
  /defaultUserUnique: uniqueIndex\("viewer_profiles_default_user_unique"\)[\s\S]*?\.on\(table\.userId\)[\s\S]*?\.where\(sql`\$\{table\.isDefault\} = true`\)/,
  "Drizzle viewer-profile metadata must retain the default-account partial unique index.",
);
requireMatch(
  viewerDefaultIntegrityValidation,
  /zero rows[\s\S]*?viewer_profiles_default_user_unique[\s\S]*?must run outside a transaction/,
  "Viewer-default index validation must record duplicate preflight and the concurrent-build boundary.",
);
requireMatch(
  viewerDefaultIntegrityValidation,
  /No production promotion has occurred[\s\S]*?no production promotion is authorized/,
  "Viewer-default validation evidence must explicitly prohibit unapproved production promotion.",
);
requireMatch(
  fastpixLib,
  /fetch\("https:\/\/api\.fastpix\.com\/v1\/on-demand", \{[\s\S]*?redirect: "error"/,
  "Credentialed FastPix clip creation must reject redirects from its fixed HTTPS API origin.",
);
requireMatch(
  fastpixLib,
  /FASTPIX_REQUEST_TIMEOUT_MS = 10_000[\s\S]*?AbortSignal\.timeout\(FASTPIX_REQUEST_TIMEOUT_MS\)/,
  "Credentialed FastPix clip creation must use an explicit bounded provider request timeout.",
);
requireMatch(
  appServer,
  /"https:\/\/stream\.fastpix\.com"[\s\S]*?"https:\/\/\*\.fastpix\.com"/,
  "CSP must retain a provider-scoped FastPix playback delivery boundary.",
);
requireMatch(
  fastpixCspReview,
  /Retain `https:\/\/\*\.fastpix\.com`/,
  "FastPix CSP review evidence must explain the intentionally provider-scoped wildcard.",
);
requireMatch(
  cinemaCatalog,
  /inArray\(cinemaTitleAssetsTable\.cinemaTitleId, titleIds\)/,
  "Cinema catalog assets must be hydrated only for published catalog title IDs.",
);
requireMatch(
  cinemaCatalog,
  /inArray\(cinemaRightsWindowsTable\.cinemaTitleId, titleIds\)/,
  "Cinema catalog rights windows must be hydrated only for published catalog title IDs.",
);
requireMatch(
  cinemaCatalog,
  /assetsByTitleId\.get\(title\.id\) \?\? \[\]/,
  "Cinema catalog must group loaded assets instead of repeatedly filtering the full result set.",
);
requireMatch(
  cinemaCatalog,
  /where\(and\([\s\S]*?eq\(cinemaTitlesTable\.id, id\)[\s\S]*?eq\(cinemaTitlesTable\.publishState, "published"\)/,
  "Cinema detail must fetch the requested published title directly rather than scanning the full catalog.",
);
requireMatch(
  apiSpec,
  /\/cinema\/titles\/\{id\}\/comments:[\s\S]*?name: limit[\s\S]*?maximum: 50[\s\S]*?default: 25[\s\S]*?name: offset/,
  "Cinema discussion must expose bounded typed top-level comment pagination.",
);
requireMatch(
  cinemaRoute,
  /isNull\(cinemaCommentsTable\.parentCommentId\)[\s\S]*?\.limit\(query\.data\.limit\)[\s\S]*?\.offset\(query\.data\.offset\)/,
  "Cinema discussion must page visible top-level comments at the database boundary.",
);
requireMatch(
  cinemaRoute,
  /inArray\(cinemaCommentsTable\.parentCommentId, rootIds\)/,
  "Cinema discussion replies must be hydrated only for the displayed root comments.",
);
requireMatch(
  cinemaRoute,
  /total: countRows\[0\]\?\.total/,
  "Cinema discussion responses must include an authoritative visible root-comment total.",
);
requireMatch(
  cinemaDiscussion,
  /CINEMA_COMMENT_PAGE_SIZE = 25[\s\S]*?commentsPage\?\.items[\s\S]*?Older comments/,
  "Cinema discussion UI must consume the typed page and expose explicit continuation controls.",
);
requireMatch(
  liveHome,
  /const totalViewers = discover\?\.totalViewers \?\? 0/,
  "Live hero metrics must use the authoritative Discover all-channel viewer total.",
);
requireMatch(
  liveHome,
  /liveFeedTabRefs[\s\S]*?moveLiveFeedTab[\s\S]*?ArrowLeft ArrowRight Home End/,
  "Live feed tabs must retain roving directional focus controls for keyboard and future remote navigation.",
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

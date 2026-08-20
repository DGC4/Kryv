# Kryv Cinema Product Audit and Implementation Blueprint

**Audit mode:** Deep, non-intrusive review of the unlocked Netflix FAM experience, plus publicly delivered page markup.  
**Objective:** Translate observable product, accessibility, security, and performance principles into an **original** Kryv Cinema experience.  
**Excluded:** Netflix proprietary source code, non-public APIs, protected media, sonic identity, brand assets, and intrusive security testing.

> **Design standard.** Kryv Cinema should be judged by its own clarity, speed, trust, and storytelling quality. It must not be a visual or functional clone of Netflix; it should apply the transferable interaction principles in a distinct Kryv design system.

## 1. Audit coverage

| Surface | Reviewed behavior | Kryv transfer value |
|---|---|---|
| Profile entry | Profile picker, managed profiles, visible locked state, add/manage actions | Separate viewing identity from account identity; make profile choice intentional |
| Home | Persistent navigation, cinematic hero, personalized rails, continuation row | Build a clear discovery hierarchy without forcing playback |
| Catalogs | Shows, Movies, New & Popular, Languages, personal list, secondary Games mode | Reusable rail/grid/filter system with category-specific editorial context |
| Title detail | Overlay, metadata, maturity context, collection, episodes, trailers, related titles | Model title relationships and support non-destructive exploration |
| Watch entry | Low-distraction player route and dependable return to title/browse context | Design an original Kryv launch and recovery transition |
| Search | Global query, direct and related matches, clear input reset | Support title, person, genre, and collection discovery |
| Profile settings | PIN lock, preferences, parental/privacy pathways, viewing activity | Build secure profile-scoped settings and recovery controls |
| Accessibility | Keyboard focus, labelled actions, persistent navigation | Define first-class keyboard, touch, reduced-motion, and future TV focus behavior |
| Asset loading | Dense art rails, modern media formats, reserved layout, limited critical preloads | Create an owned responsive-art delivery pipeline |

## 2. Product principles to adopt

### 2.1 Intentional viewing identity

Profile selection is not a decorative screen. It establishes the viewer whose maturity settings, continuation state, saved titles, language choices, viewing activity, and lock state govern the rest of the session. Kryv must select a profile before profile-scoped discovery and progress data are loaded.

The first Kryv Cinema entry should therefore be a branded, minimal profile chooser with these original elements:

| Requirement | Kryv implementation |
|---|---|
| Profile clarity | Distinct owned-avatar tile, display name, optional maturity badge, focused/selected state |
| Lock visibility | Lock icon and label, without exposing protected viewing data |
| Management boundary | Owner-only **Manage profiles** entry separated from ordinary viewing |
| Safe switching | Revoke current profile-unlock grant and clear profile-scoped in-memory state on switch |
| Empty state | First-run option to create a profile, with owner confirmation where required |
| TV readiness | Predictable directional navigation grid, remote-safe primary actions, no hover dependency |

### 2.2 Editorial discovery hierarchy

The home surface establishes the content hierarchy in three layers: global navigation, a featured hero, and named rails. This is useful because it gives a viewer one obvious action while preserving multiple non-disruptive discovery paths.

Kryv should implement a dedicated `CinemaShell` with a visually original deep-charcoal, graphite, and electric-cyan direction—not Netflix red, type, marks, sounds, or layouts. It should provide:

1. A responsive top bar with Cinema, Watch, Live, Library, Search, and viewer profile actions.
2. An owned hero treatment with safe title text, quality artwork, content context, `Watch`, `Details`, and `Save` actions.
3. A portable `MediaRail` component with labelled rows such as Continue, New on Kryv, Trending, Because You Watched, and editorial collections.
4. An accessible `MediaCard` with a fixed visual ratio, title label, metadata, progress indicator where appropriate, and explicit action menu for touch users.
5. A first-class empty/loading/error state for every dynamic rail.

### 2.3 Category and ranking treatment

Shows, movies, new releases, personal lists, language discovery, and secondary modes can share the same shell without feeling identical. The interface changes the hero context, filters, editorial rail labels, and metadata rather than rebuilding the entire navigation system.

Kryv should treat categories and collections as data-driven configuration rather than hardcoded route-specific markup. A collection should support title, descriptive label, image strategy, sort rule, content filters, visibility scope, and optional ranking or availability badge. Rankings must be explainable, and generated recommendations must not imply editorial judgement where none exists.

### 2.4 Title detail as a reversible decision layer

A viewer should be able to understand a title before beginning playback. Kryv title detail must preserve the browse context and offer a fast, unambiguous close/back action. It should show only data Kryv controls or is licensed to show.

| Detail section | Required data |
|---|---|
| Primary identity | Title, logo/text treatment, artwork, type, duration or season count, release year |
| Context | Synopsis, creators/credits where permitted, genres, content descriptors, maturity gate |
| Actions | Watch/resume, save/remove, share if enabled, report, more actions |
| Series navigation | Season picker, episode sequence, duration, progress, episode synopsis |
| Discovery | Related titles, collection/franchise links, trailers owned or licensed by Kryv |
| Trust and safety | Availability state, region/rights notice where required, profile maturity enforcement |

### 2.5 Original Kryv launch treatment

Kryv Originals may use a brief original opening transition, but it must never imitate a third-party ident or sonic signature. The launch sequence should be optional, skippable, accessible, silent-by-default until user gesture, and disabled or reduced when `prefers-reduced-motion` is active.

The implementation should use a Kryv-owned logo, a 1.5–2.5 second motion treatment, an ARIA-labelled skip action, a no-animation fallback, and a definite error/back path. The player must retain profile context without placing personal data in media URLs.

## 3. Secure profile architecture

Kryv’s existing secure server sessions are the starting point. Cinema profiles require a separate, scoped unlock state rather than a second browser token.

| Control | Required behavior |
|---|---|
| Profile PIN | Store a slow password hash; never return it, log it, or use client-side reversible storage |
| Unlock grant | Server-side short-lived record bound to user session, profile, expiry, and device/browser characteristics where appropriate |
| Attempt controls | Rate-limit attempts, apply incremental cooldown, create audit event on failed/successful lock attempts |
| Owner reset | Require a fresh account-authentication step and explicit reset confirmation; invalidate outstanding unlock grants |
| Profile switch | Clear active profile context, invalidate the previous unlock grant, reload scoped data |
| Maturity gating | Enforce in API queries and playback authorization, never only in UI filtering |
| Deletion | Owner-only; require confirmation and preservation/deletion policy for viewing records |
| Privacy | Profile-specific export/delete pathway; no cross-profile activity disclosure |

## 4. Required media and database model

The current application must evolve from isolated video fields into a catalog relationship model. The initial additive schema should include an explicit profile layer and content entities rather than overloading user records.

| Entity | Core fields | Security/performance notes |
|---|---|---|
| `viewer_profiles` | account owner, display name, avatar key, maturity mode, language defaults, lock state | Enforce account ownership; do not store a PIN itself |
| `profile_lock_attempts` | profile, timestamp, outcome, bounded diagnostic metadata | Use short retention and rate-limit from it or a dedicated limiter |
| `profile_unlock_grants` | hashed opaque grant, session, profile, expiry, revocation state | Short-lived, server-only validation |
| `media_titles` | type, title, synopsis, maturity, release metadata, availability | Index visibility and content type |
| `media_assets` | title, owned storage key, art kind, dimensions, responsive variants | Immutable versioned keys; no public admin paths |
| `media_collections` | label, criteria/configuration, position, visibility | Configuration is validated and owner-administered |
| `collection_titles` | collection, title, rank, badge/context | Supports editorial and algorithmic rails |
| `series_seasons` / `series_episodes` | series hierarchy, duration, episode order, playback asset | Enforce title availability and maturity before query |
| `profile_library` | profile, title, saved timestamp | Unique `(profile, title)`; never account-global by default |
| `profile_progress` | profile, episode/title, progress, completion, last viewed | Validate profile unlock/maturity before read/write |

## 5. Responsive, accessibility, and TV requirements

Kryv must not build desktop hover behavior that fails on mobile or future TV clients.

| Interaction | Desktop | Mobile web | Future TV / remote |
|---|---|---|---|
| Rail movement | Scroll / pointer plus buttons | Touch drag plus clear more action | Directional left/right with focus preservation |
| Card actions | Hover may reveal actions; focus must do the same | Tap opens detail; menu offers actions | Select opens detail; menu key opens actions |
| Detail | Overlay or route with Escape/close | Full screen sheet/route with back | Full page panel with Back control |
| Navigation | Persistent top bar | Collapsed nav and search | Focusable fixed navigation rail/header |
| Profile lock | Modal with controlled PIN input | Full-screen secure prompt | Large numeric remote-friendly keypad |
| Motion | Optional transition | Reduced animation, bandwidth aware | Stable deterministic focus transitions |

Every interactive control must have an accessible name, clear focus visibility, keyboard operability, and a semantic loading/error state. Use `prefers-reduced-motion`, `prefers-contrast`, and system font scaling without breaking card grids.

## 6. Asset and load-performance blueprint

### 6.1 Image pipeline

Kryv should use an owned object store/CDN. Each uploaded or ingested art asset needs width/height metadata and derivatives at defined size buckets. Original assets must be private; delivery URLs must be cache-versioned and rights-aware.

| Asset type | Ratios | Suggested derivatives | Loading policy |
|---|---:|---|---|
| Hero backdrop | 16:9 / 21:9 | 640, 960, 1440, 1920, 2560 | Preload only the active hero; use low-quality placeholder if needed |
| Rail landscape | 16:9 | 320, 480, 640, 960 | First visible row eager/high priority; subsequent rows lazy |
| Poster | 2:3 | 240, 360, 480, 720 | Lazy by default; reserve ratio |
| Profile avatar | 1:1 | 64, 128, 256 | Eager only on picker and account menu |
| Episode still | 16:9 | 320, 480, 640 | Lazy until season section is opened |

Use AVIF where available, WebP fallback, `srcset`/`sizes`, `width` and `height` or CSS `aspect-ratio`, `decoding="async"`, and lazy loading for all content below the initial viewport. Never auto-download video previews for an entire rail. A delayed hover/focus preview must be cancellable and disabled on constrained networks or reduced-motion preference.

### 6.2 Performance budget

Kryv should define measurable budgets before implementation. Target values must be validated against the deployed infrastructure, not assumed.

| Measure | Initial budget | Required instrumentation |
|---|---:|---|
| Initial route JavaScript | Keep route-specific and avoid a monolithic Cinema bundle | Bundle analyzer and CI artifact report |
| First visible images | Hero plus only essential first rail images | Browser Performance/Lighthouse trace on production-like build |
| Layout shift | No image-driven shift | Reserved dimensions and Web Vitals capture |
| Interactive response | Card, profile, and search actions feel immediate | Client performance marks and API latency measurement |
| Search | Debounced and cancelable | Abort stale requests; capture query latency and zero-result rate |
| Media start | Auth/maturity/progress checks before signed playback URL | Time-to-first-frame telemetry, no sensitive URL logging |

## 7. Security verification scope for Kryv

The security work must be authorized, reproducible, and limited to Kryv systems. It should include static review, configuration review, automated tests, and controlled test accounts—not attacks on third-party services.

1. Verify every Cinema API uses account ownership plus active profile/unlock context where applicable.
2. Test direct-object-reference attempts across test profiles and accounts for library, progress, assets, and lock-reset endpoints.
3. Confirm PIN hashes and opaque grants never appear in client responses, browser storage, logs, analytics, error payloads, or URLs.
4. Test profile-lock rate limits, expiry, reset invalidation, and account-session invalidation paths.
5. Validate title/episode maturity gates server-side, including direct URL/API access.
6. Run dependency, secret, TypeScript, formatting, and source-invariant checks in CI when the hosting account can execute workflows.
7. Test content-security policy, trusted origins, cookie session behavior, error redaction, and media asset upload validation.

## 8. Implementation backlog

| Priority | Work item | Acceptance condition |
|---|---|---|
| P0 | Add secure viewer-profile and unlock-grant model | Profile ownership, hashing, expiry, revocation, and migration tests pass |
| P0 | Implement server-authorized profile switching and PIN verification/reset | No cross-profile data leakage; reset invalidates all unlock grants |
| P0 | Implement original profile chooser and management surfaces | Accessible desktop/mobile flow with clear locked state |
| P0 | Add title, collection, library, and progress domain model | Additive migration with indexes and parity check |
| P1 | Build Cinema shell, responsive hero, rails, and title detail | Works at narrow and wide layouts; all controls keyboard-accessible |
| P1 | Create asset-derivative contract and lazy-loading card system | No visible card image layout shift; no bulk preview downloads |
| P1 | Add search, category, list, episode, and resume flows | Query cancellation, empty state, profile scoping, maturity enforcement |
| P1 | Add original Kryv launch treatment | Skippable, motion-reduced, owned assets only |
| P2 | Add editable editorial collections and recommendation tooling | Audited, validated, and reversible collection changes |
| P2 | Prepare TV navigation adapter and native-app API contract | Stable focus/state model independent of CSS hover |

## 9. Audit conclusion

The valuable lesson is the system design: an intentional profile boundary; a stable but flexible discovery shell; rich metadata and reversible title decisions; explicit watch-entry/recovery; fast, ratio-stable art delivery; and accessibility as a product constraint. Kryv can exceed this standard by making its security boundaries, privacy controls, recommendation explanations, and cross-mode Cinema/Watch/Live transitions more transparent and coherent from the first implementation.

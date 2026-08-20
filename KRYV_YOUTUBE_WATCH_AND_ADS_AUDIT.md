# Kryv Watch and Advertising Product Audit

**Audit mode:** Non-intrusive review of normal YouTube home, search, Watch, player settings, and visible advertising states in the connected browser.  
**Objective:** Define transferable Watch and advertising principles for an original Kryv implementation.  
**Exclusions:** Third-party source code, advertising-network internals, protected media, advertiser conversion actions, and any attempt to bypass platform controls.

> **Implementation boundary.** Kryv should build an original Watch and advertising system. Observable patterns describe product requirements; they are not a license to copy interface assets, wording, proprietary ranking logic, player technology, or advertising infrastructure.

## 1. Observed product structure

| Surface | Observable behavior | Original Kryv requirement |
|---|---|---|
| Home feed | Ratio-stable skeletons before data, topic chips, guide navigation, mixed content cards | `WatchHome` with owned skeletons, typed discovery modules, and a stable layout shell |
| Search | Query input, fast chips, advanced filters, mixed results with explicit labels | Cancelable, debounced Kryv Search with explainable filters and zero-result recovery |
| Result cards | Thumbnail, duration, creator, views/activity, time, quality/chapters, context labels | `WatchCard` with accessible metadata and distinct organic/promoted labels |
| Watch page | Player, creator block, metadata, actions, comments, sidebar context | Modular `WatchShell` with independently authorized components |
| Player settings | Captions, speed, quality, theatre/full-screen, keyboard shortcuts | Capability-aware playback preferences with server/provider validation |
| Recommendations | Context chips plus sidebar feed from search, series, creator, topic, and generic related content | Explainable recommendation sources with profile preferences and opt-out controls |
| Ads | In-player sponsorship disclosure, advertiser identity, commercial CTA, skip control, user ad controls, sponsored sidebar cards | A controlled serving layer with disclosure, consent, frequency, safety, auditability, and kill switch |

## 2. Watch information architecture

Kryv Watch needs to differ structurally from Kryv Cinema. Cinema is a catalog-first experience organized around titles, seasons, curated collections, and profile-scoped viewing. Watch is creator-first and event/activity-aware. Its cards must make creator identity, live/archive status, duration, topic context, and publishing recency legible at a glance.

### 2.1 Required route model

| Route | Purpose | Required server checks |
|---|---|---|
| `/watch` | Personalized and editorial video discovery | Viewer/session context, profile/age preference where relevant |
| `/watch/search` | Query and filters | Input validation, rate limit, safe query syntax, cancellation support |
| `/watch/:videoSlug` | Video page | Publication/rights state, visibility, maturity, creator/channel status |
| `/watch/:videoSlug/comments` | Moderated discussion | Membership/identity policy, block/ban/moderation checks |
| `/channels/:handle` | Creator identity and catalog | Handle validation, public/private visibility, creator account state |
| `/library/watch-later` | Profile-scoped saved items | Account and active-profile ownership |
| `/watch/history` | Profile-scoped history | Account/profile ownership, privacy controls |

### 2.2 Watch shell composition

`WatchShell` should not become a single monolithic component. It should contain an owned `KryvPlayer`, `VideoIdentityPanel`, `CreatorPanel`, `ViewerActions`, `DescriptionPanel`, `RecommendationPanel`, `DiscussionPanel`, and optional `AdSlot` only when the server returns a signed, policy-eligible decision.

| Module | Data boundary | Safety requirement |
|---|---|---|
| Player | Playback manifest/token and transient player preference | Never expose storage credentials or internal provider payloads |
| Video identity | Title, creator, duration, visibility, content flags | Server-validated public fields only |
| Viewer actions | Like, save, share, report | CSRF/origin/session control and idempotency where needed |
| Creator panel | Follow/subscribe state, verified status if any | No misleading verification markers |
| Recommendations | Candidate titles plus explanation source | Respect block, age, privacy, and user preference rules |
| Discussion | Comment/chat pagination and moderation state | Abuse rate limits, moderation pipeline, author privacy controls |
| Advertising | `AdDecision` plus signed tracking events | Explicit gate, consent, frequency, content suitability, kill switch |

## 3. Search and discovery requirements

Search should have a compact fast-filter tier and an advanced filter tier. The UI must not expose filters the backend cannot actually honor.

| Filter group | Initial Kryv options | Verification rule |
|---|---|---|
| Content type | Video, short clip, live replay, channel, playlist/collection | Filter translated to an indexed server query |
| State | Live, scheduled, completed, unwatched, watched, saved | Requires viewer/profile context; do not cache cross-profile |
| Duration | Short, medium, long | Derived from canonical duration field |
| Recency | Today, week, month, year | UTC-safe bounded query |
| Media capability | Captions, 4K/HDR, chapters, downloadable where licensed | Display only from validated processing/provider state |
| Sort | Relevance, newest, popularity | Stable pagination and transparent source indicator |
| Safety | Maturity/region/language availability | Enforced server-side, not only filtered in UI |

Kryv should use abortable browser requests, query debouncing, separate query and facet loading states, no-results guidance, keyboard-operable chips, and escape/back behavior that never loses the user’s typed query unexpectedly.

## 4. Advertising system: extend the existing control plane

The repository already contains an owner-controlled advertising control plane with campaign, creative, rule/break, impression, consent/inventory, funding, and audit concepts. Crucially, delivery is **hard-disabled**. This is the correct state while full serving safeguards are still being defined and tested.

### 4.1 Required advertising decision contract

The existing decision response should evolve only after a new additive schema/migration and controlled branch validation. A future eligible response must include only the minimum necessary information:

| Field | Purpose |
|---|---|
| `decisionId` | Opaque idempotency and audit correlation identifier |
| `placement` | Explicit owned placement enum, such as `watch_preroll`, `watch_midroll`, `watch_sidebar`, `watch_feed`, `cinema_rail`, `live_break` |
| `disclosure` | Standardized sponsored/house/promotion label and advertiser identity |
| `creative` | Reviewed asset reference, duration, media type, CTA policy—not storage credentials |
| `skipPolicy` | Server-determined eligibility and timing, never client-guessed |
| `trackingPolicy` | Permitted event types and expiry; does not encode personal data |
| `frequencyPolicy` | Cap/window information enforced by the server |
| `consentState` | Server-resolved permitted/non-permitted decision basis |
| `safetyContext` | Maturity/category/region/profile exclusion outcome |

### 4.2 Serving requirements before the hard gate can open

| Control | Must be demonstrated before launch |
|---|---|
| Consent | Clear jurisdiction-appropriate consent and refusal path; no decision based on disallowed data |
| Disclosure | Sponsored/house/promotional status and advertiser identity shown in every placement |
| Creative review | Human/owner-approved, rights-cleared, policy-scanned creative with expiry and revocation |
| Placement policy | Allowed content surfaces and category/maturity exclusions defined in the server rules |
| Frequency | Per-profile and per-session caps, cooldowns, deduplicated impression accounting |
| Measurement | Signed, idempotent impression/quartile/completion/click events with bot-abuse detection |
| Privacy | Bounded retention, no unnecessary sensitive or cross-profile data, user controls |
| Security | Owner authorization, read/write separation, anti-IDOR tests, safe external redirects, input validation |
| Operations | Real-time kill switch, campaign/creative pause, audit log, dashboards, reconciliation workflow |
| Financial boundary | No automated payout, custody, or invoice activation as part of visual advertising work |

### 4.3 Placement design

Kryv must avoid deceptive placement. Paid placements should never masquerade as organic recommendations. Initial supported placements should be conservative: clearly labelled feed cards, clearly labelled sidebar cards, and optional skippable pre-roll only after media-delivery controls are validated. Mid-roll, live break, personalized targeting, and any creator revenue allocation must remain disabled until tested measurement, consent, and reconciliation requirements are proven.

## 5. Player and accessibility requirements

Kryv Player should support only capabilities that the playback provider can deliver and should expose them through a consistent, accessible menu.

1. Play/pause, seek, mute/volume, captions, quality, playback rate, picture/theatre/full-screen where technically supported.
2. Full keyboard operation with documented shortcuts, visible focus, controls that remain available by pointer and touch, and no hover-only safety action.
3. `prefers-reduced-motion`, data-saver, and caption preference support.
4. Honest unavailable states rather than disabled controls that imply a missing user permission.
5. Clear player loading, error, reconnect, rights/restriction, and stream-ended states.
6. Signed, short-lived playback authorization with server-side validation of visibility, rights, profile/maturity, and subscription/entitlement rules.

## 6. Performance requirements

| Area | Kryv implementation standard |
|---|---|
| Discovery cards | Skeleton first, fixed ratio, responsive images, lazy load below first viewport |
| Search | Debounce, abort stale requests, pagination, client cache keyed by active profile and filter state |
| Watch route | Split player, discussion, recommendations, and comments into independently loadable modules |
| Player | Load poster/control shell first; defer non-critical metadata; do not preload all recommendation imagery |
| Ads | Resolve decision asynchronously and fail closed; never block core content on a disabled/failed ad decision |
| Metrics | Record owned Web Vitals and API timings; no raw tokens or sensitive profile data in telemetry |

## 7. Initial implementation backlog

| Priority | Item | Acceptance condition |
|---|---|---|
| P0 | Verify existing advertising control-plane schema against Neon | Repository and branch schema parity documented; no production activation |
| P0 | Add policy tests around disabled advertising decision/recording endpoints | Tests prove fail-closed behavior without runtime enablement |
| P0 | Build owned `WatchCard`, skeleton, and search shell | Responsive and accessible; organic vs paid component variant distinct |
| P0 | Define player capability contract | UI only renders validated provider capabilities |
| P1 | Implement creator/video/recommendation module boundaries | Independent auth, loading, error, and cache policies |
| P1 | Add profile-scoped Watch history, saved state, and recommendation explanations | No cross-profile data exposure |
| P1 | Add conservative ad-placement presentation components behind false feature flag | No decision/service until dedicated gates are passed |
| P2 | Add gated measurement pipeline and operator observability | Signed idempotent events, caps, privacy retention, kill-switch drill |
| P2 | Consider live/mid-roll delivery only after controlled production-readiness review | Explicit user approval and operational evidence required |

## 8. Conclusion

The transferable lesson is a separation of concerns: content discovery, creator identity, playback, interaction, recommendations, discussion, and advertisements each have their own clear surface and data boundary. Kryv can improve on this baseline by making advertising consent, placement rationale, data use, content suitability, frequency controls, and revenue-state boundaries transparent from the beginning. The existing hard-disabled advertising control plane should be preserved and strengthened—not activated—until the stated delivery conditions are verified.

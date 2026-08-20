# Kryv Live Product and Advertising Audit

**Audit mode:** Non-intrusive observation of public Kick and Twitch desktop discovery, public live channels, browse/category routes, chat boundaries, visible creator-support controls, player controls, and public advertising-policy/disclosure states.  
**Objective:** Translate transferable live-streaming product principles into an **original Kryv Live** experience.  
**Audit boundary:** This document does not reproduce third-party source code, proprietary delivery systems, media, interface assets, language, or brand treatments. It records user-observable product patterns and defines Kryv-owned requirements.

> **Operating rule.** Kryv’s future free-tier advertising covers Cinema, Watch, and Live. Advertising remains runtime-disabled until the required consent, review, frequency, measurement, safety, and operator controls are implemented, tested, and separately approved.

## 1. Observed Live product architecture

| Product concern | Observable transferable pattern | Original Kryv requirement |
|---|---|---|
| Global navigation | Persistent top bar plus a collapsible followed/recommended channel guide | `LiveShell` with a keyboard-accessible `LiveGuide` that is reduced to a tab, drawer, or rail at narrow widths |
| Discovery | A featured stream, personalized rails, broad popularity modules, category-first browsing, and clips | Separate server-backed modules for `FeaturedLive`, `FollowingNow`, `RecommendedLive`, `TrendingLive`, `BrowseCategories`, `PopularClips`, and `LiveReplays` |
| Live cards | Live label, current viewers, creator identity, title, category, language/tags, maturity context | An owned `LiveCard` that reserves image space and makes policy-relevant facts visible without relying on hover |
| Channel route | Large player stage, identity/actions, chat pane, viewer context, and related channels | Modular desktop layout: `LiveGuide`, `KryvPlayer`, `StreamIdentityPanel`, `CreatorSupportPanel`, `LiveChat`, and `RelatedLive` |
| Chat | Independent scroll surface, group/moderation context, visible participant eligibility, emotes/settings | Server-authoritative `ChatAccessState`, independently reconnectable realtime connection, reporting/moderation entry points, and accessible composer states |
| Creator support | Follow, subscription, gifts, rewards, goals, and tip/balance actions are differentiated from chat and playback | User-initiated flows only; no player/chat/ad component may invoke money, support, or follow actions implicitly |
| Advertising | Labelled commercial module with ad-specific player controls, CTA, feedback, and an ad-free entitlement cue | Discrete `AdSlot` and `AdDisclosure` components behind an explicit false feature flag and signed server decision contract |

## 2. Discovery and navigation blueprint

Kryv Live should distinguish between **topic-first** discovery and **creator-first** discovery. A popular category and a currently relevant channel are different result types, should have different ranking inputs, and need separate availability/safety rules. The interface may unify them visually through Kryv’s charcoal, graphite, and electric-cyan design system, but the data contract should not collapse them into an untyped feed.

| Module | Minimum card data | Server-side eligibility requirements |
|---|---|---|
| Featured live | Channel, title, live state, viewer count, category, language, maturity state, poster/preview, join action | Stream session is public/live, channel not suspended, region/maturity conditions pass |
| Following now | Channel, viewer count, title, live status | Viewer relationship plus channel visibility; profile restrictions apply |
| Category browse | Canonical category, taxonomy tags, active viewers, preview art | Category is active and moderation-approved; no arbitrary free-text category becomes targeting data |
| Live cards | Stream state, title, creator, category, language, viewers, badges/maturity | Rights/visibility, profile maturity, channel status, regional policy |
| Clips and replays | Duration, source, publish state, creator/channel, content flags | Processing/rights/publish state, profile maturity, creator moderation policy |
| Related live | Candidate plus explanation such as same category, followed creator, editorial collection | Respect blocked channels/users, privacy choices, profile maturity, and content availability |

The Live guide should persist only when space permits. On narrow mobile web, TV, or future app layouts, it should yield first to player readability. A narrow-screen user needs a predictable way to switch among player, chat, and discovery, rather than a compressed three-column view. A future TV-ready focus model should expose all major controls in deterministic tab order and support an obvious remote-navigation path.

## 3. Channel, player, and chat model

A production Live route must be constructed from independently authorized modules. Playback availability must not grant chat access; chat access must not grant creator-management rights; creator-support controls must never be bundled into an automatic player event.

| Module | Required state | Safety and quality boundary |
|---|---|---|
| `KryvPlayer` | Loading, live, reconnecting, unavailable, ended, restricted, fatal error | Short-lived provider authorization; no provider secret/asset-upload credential reaches the browser |
| `StreamIdentityPanel` | Live state, title, creator, category, language, viewers, uptime, content/maturity labels | Fields are server-derived and sanitized; values cannot be overwritten by client state |
| `CreatorSupportPanel` | Follow/subscription/tip/gift availability, loading/error/success, purchase handoff | Explicit click only, CSRF/session safeguards, idempotency for monetary intents, never triggered by playback/ad code |
| `LiveChat` | Connection, access mode/reason, chat history, moderation state, rate/slow-mode state, report action | Separate realtime authentication, message rate limits, anti-spam pipeline, block/ban/timeout enforcement, safe reconnection |
| `RelatedLive` | Candidate cards and `whyThis` explanation | Server filters for profile, region, visibility, safety, and blocks before response |
| `AdSlot` | Disabled/no-fill/loading/eligible display state, disclosure, CTA policy, skip state, report/feedback | Renders only when a signed, unexpired, server-authorized decision exists; disabled state produces no ad chrome |

### 3.1 Player requirements

The owned Kryv player must expose a control only when its provider/capability contract permits it. It should support conventional play/pause, mute/volume, captions, quality, theatre/full-screen, and keyboard shortcuts where available. Visible focus, touch targets, caption preference, `prefers-reduced-motion`, data-saver behavior, and useful loading/restriction/error states are release requirements rather than polish work.

The player must reserve its layout ratio while media loads. Live chat and related-content loading must be independent. A chat connection failure therefore cannot prevent a viewer from seeing a stream, and a playback provider outage cannot conceal reporting or safety information.

### 3.2 Chat-access contract

Kryv should return a typed, server-authoritative access model before activating the composer. The UI must clearly tell a viewer why they can or cannot participate without asking the client to infer a privileged state.

| Access mode | Example user-facing implication | Enforcement location |
|---|---|---|
| `public` | A signed-in viewer may post subject to rate policy | Server/message route and realtime gateway |
| `follower_delay` | Viewer must follow for the configured period before posting | Relationship timestamp verified by server |
| `subscriber_only` | Subscription entitlement is required | Server-side entitlement policy |
| `account_age` | New accounts must wait before posting | Canonical account creation time |
| `verified_account` | Additional account verification is required | Identity/verification service state |
| `slow_mode` | A cooldown applies between messages | Atomic server/realtime rate limit |
| `timed_out` / `banned` | Posting is unavailable with an appropriate policy message | Channel moderation records |
| `moderator` / `creator` | Elevated moderated actions are possible | Explicit channel role/permission grant |

## 4. Free-tier advertising: stronger controls before delivery

Kryv currently has a robust **control-plane foundation**—campaigns, creatives, funding, rules, breaks, impressions, revenue movements, consent, and audit structures—but delivery is hard-disabled. That state is intentional and must remain true while implementing product surfaces.

The purpose of the next iteration is not to activate monetization. It is to make the policy, UI, entitlement, and future decision contract safe, inspectable, and consistent across **Cinema, Watch, and Live**.

### 4.1 Required entitlement resolution

| Input | Server decision rule | Client treatment |
|---|---|---|
| Surface | `cinema`, `watch`, `live`, or another canonical surface from the server route | Client passes route context only; it does not decide eligibility |
| Account entitlement | Server resolves whether the account is on a free or ad-free eligible tier | Render no ad container when ineligible; do not create a client bypass path |
| Active profile | The active profile must be authenticated/owned and covered by a short-lived selection grant | The client may display the selected profile but cannot nominate arbitrary IDs for policy decisions |
| Consent | Server resolves whether contextual, personalized, measurement, or no-ad behavior is allowed | UI reflects the decision; it cannot override a withdrawn/absent consent state |
| Maturity/safety | Creative content rating and placement must satisfy profile/content restrictions | Reject before creative payload reaches client |
| Region/right/availability | Current policy/rights context must match | Reject/no-fill without disclosing private policy signals |
| Frequency | Atomic per-profile/per-session/per-campaign limits and cooldowns must pass | Client may show a neutral no-fill state only |

### 4.2 Placement rules

| Surface | Conservative first placement | Must not be placed in | Additional required safety boundary |
|---|---|---|---|
| Cinema | Clearly disclosed pre-play placement or labelled collection card only when eligible | Profile chooser, PIN flow, maturity warning, title rights/restriction state | Preserve title playback even when no decision/failure occurs |
| Watch | Clearly disclosed pre-roll or labelled feed/sidebar card | Search-result semantics, comment composer, creator actions, player error/retry controls | Never disguise paid video as an organic recommendation |
| Live | Clearly disclosed pre-roll or a separate browse/display unit | Chat composer, chat-access message, moderation/report tools, follow/sub/gift/tip controls | Avoid mid-roll until interruption, caps, and creator-control policy are validated |

Any client-facing sponsored content must use a dedicated layout with persistent disclosure, advertiser/payer identity, consistent label semantics, accessible reporting/feedback, reviewed CTA destination, and a clearly described skip state when the policy allows one. A future video creative must support captions and mute/volume behavior. The absence of an eligible decision, consent, or fill must never block content discovery, title playback, live playback, chat safety controls, or user navigation.

### 4.3 Creative and privacy safety requirements

The public Kick advertising policy states that advertising should be honest, identified, privacy-conscious, and non-deceptive; it also prohibits unauthorized tracking/fingerprinting and requires disclosure for some realistic synthetic-media uses. These are strong transferable principles, not a license to copy another platform’s rules verbatim. [1]

Kryv’s implementation must persist an owner-reviewed advertiser/payer identity, creative rights attestation, safety category, maturity classification, region policy, expiry, revocation state, CTA allowlist result, and synthetic-media declaration before a creative can ever be eligible. No creative asset should execute third-party scripts. The frontend must not send raw profile, account, browser-storage, or cross-site identifiers to a creative or landing destination. Measurement must use signed, short-lived, idempotent event permissions and must not accept a client claim that an impression was qualified or revenue-producing.

## 5. Accessibility and performance standards

| Area | Production-grade standard |
|---|---|
| Keyboard/remote | Visible focus, deterministic focus order, documented player shortcuts, no mouse-only disclosure/skip/report action |
| Touch/mobile | Independent player/chat tabs or bottom sheet; 44px-scale interactive targets; no compressed unreadable three-column layout |
| Visual stability | Skeletons and aspect-ratio reservation for hero, cards, player, chat, and advertising placeholders; avoid cumulative layout shift |
| Loading | Abort stale search/discovery requests; lazy-load below-fold images; code-split chat, recommendations, and noncritical player panels |
| Errors | Separate player, chat, recommendations, advertising, and support-action loading/error/retry states |
| Privacy | Pseudonymous/minimized server context, opt-in measurement/personalization, clearly accessible controls, bounded retention |
| Safety | Server-controlled maturity, rights, visibility, block/ban, and region policy before rendering candidates or interactive controls |

## 6. Initial original Kryv Live implementation backlog

| Priority | Work item | Acceptance condition |
|---|---|---|
| P0 | Establish `LiveShell`, `LiveGuide`, `LiveCard`, and independently loadable Live modules | Responsive desktop/narrow layout, keyboard operation, stable skeleton/loading/error states |
| P0 | Define server-authoritative active-profile grant and ad-entitlement contract | Account ownership and selected profile cannot be forged from the client; delivery remains false |
| P0 | Add `AdSlot`, `AdDisclosure`, `AdControls`, and `AdFeedback` presentation components behind a permanently false runtime flag | No current decision may render a live creative; paid and organic layouts are impossible to confuse |
| P0 | Add automated tests for disabled decision, profile ownership, free/ad-free eligibility, consent denial, no-fill, and CTA validation | Tests prove fail-closed behavior on Cinema, Watch, and Live |
| P1 | Implement typed `ChatAccessState` and isolated chat error/reconnect flow | The composer always states applicable eligibility and respects moderation/rate limits server-side |
| P1 | Add server-backed category/live browse and explainable related-live responses | Pagination/filtering/safety is enforced before client response |
| P1 | Implement owned capability-aware Kryv player states | No unavailable control is presented as actionable; captions/reduced-motion/loading/error states verified |
| P2 | Add a future gated frequency/measurement pipeline | Atomic caps, signed idempotent events, bot signals, operator audit trail, and kill-switch drill are proven before activation |
| P2 | Consider creator-initiated Live break controls | Only after spacing, viewer safety, disclosure, reporting, and audit requirements pass dedicated review |

## 7. Conclusion

The strongest transferable live-streaming principle is **clear separation**: discovery is separate from playback; playback is separate from chat; chat is separate from moderation; support is separate from advertising; and advertising is separate from account/profile authorization. Kryv can improve on legacy patterns by treating active profile, maturity, entitlement, consent, advertiser identity, creative safety, frequency, and measurement as explicit server-side contracts from the first implementation.

## References

[1] [Kick Advertising Guidelines](https://kick.com/advertising-policy)  
[2] [Kick Home](https://kick.com/)  
[3] [Twitch Home](https://www.twitch.tv/)  
[4] [Twitch Browse](https://www.twitch.tv/directory)

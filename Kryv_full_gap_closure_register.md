# Kryv Full Gap-Closure Register

**Status:** Active production release register
**Scope:** Every gap raised in the Kryv competitive review, including the money loop, product density, advertising, trust, and scale dependencies.
**Operating principle:** A capability is either delivered and verified, or it is visibly gated with a documented activation requirement. Kryv never represents a future capability as live.

## Revenue and settlement policy

Kryv’s creator economics are defined in crypto settlement units. For eligible creator subscriptions and tips, **95% of the provider-confirmed crypto subtotal is credited to the creator and 5% is recorded as Kryv platform revenue**. The provider’s White Label checkout commission is separately shown to, and paid by, the customer. It is never hidden inside the 95/5 split. USD prices are invoice-creation references only; provider-confirmed crypto amounts and immutable ledger movements are settlement authority.

> The ad-funded model is separate from the subscription and tip split. No creator ad earning is created from an impression, a forecast, or a free campaign. It must trace to a verified advertiser-funded campaign, an approved delivery rule, a qualified completion record, and an immutable revenue allocation.

## Full release-gate register

| # | Gap | Current treatment | Release gate or build outcome |
| --- | --- | --- | --- |
| 1 | Free-tier host for irreversible payouts | Free-tier fallback is live | Payouts remain owner-approved, idempotent, and rate-limited; first on-chain reconciliation and an always-on service are required before autonomous scale. |
| 2 | First payout not reconciled | Not yet proven | Require a small owner-reviewed payout with provider ID, transaction URL, and ledger reconciliation before claiming operational proof. |
| 3 | Merchant secret rotation | Outstanding | Rotate in the provider console, replace the Render masked secret, then confirm signed callback health. |
| 4 | Provider request-IP controls | Intentionally unset | Keep empty only while the free host has no stable egress IP; document the compensating callback signature and owner-review controls. Lock an IP when a stable egress exists. |
| 5 | No isolated worker in production | Code-ready, not deployed | Inline executor remains a bounded free-tier fallback; queue and isolated worker become a required scale gate. |
| 6 | Inline payout on API process | Bounded fallback | Atomic claim, idempotency, fee estimate, and owner approval are mandatory; no retry-after-unknown-provider-result path is permitted. |
| 7 | Cold starts and sleep risk | Free-tier constraint | Keep health monitoring active; require an always-on deployment before unattended payout operations. |
| 8 | Customer custody not live | Intentionally disabled | Maintain feature flag off until reconciliation, compliance, and custody controls are independently approved. |
| 9 | No production PubSub chat | Gateway code-ready | Deliver client reconnect/status UX and preserve REST authority; deploy Redis + gateway before claiming push chat. |
| 10 | Player engagement density | Points, polls, predictions, raids present | Add creator controls, visible live-state updates, participation feedback, and mobile density improvements. |
| 11 | Clips growth loop | Live clipping exists | Extend viewer clip discovery, sharing, and short-form surfaces without opening unauthorized VOD clipping. |
| 12 | Micro-cheer culture | Crypto tips are heavier | Provide exact-crypto quick support presets and pinned supporter moments; no custody or fiat shortcut is implied. |
| 13 | Extensions ecosystem | Not live | Publish a scoped post-MVP extension contract only after stable auth, moderation, and rate limits. |
| 14 | Global emote culture | Global/channel emotes exist | Add emote discovery and moderation-safe management before opening public submissions. |
| 15 | Monetization without network effects | Early-stage inventory | Make eligibility, fee policy, and creator economics explicit; never promise earnings. |
| 16 | Public 95/5 clarity | Building | Versioned 500-bps policies, checkout disclosure, creator-wallet explanation, and owner reporting are release requirements. |
| 17 | Audience flywheel | Early-stage inventory | Build followed-live, clipping, search, referrals, and advertiser campaigns; creator acquisition is an operating program, not a code claim. |
| 18 | Multistream and incentives | Not live | Add policy, disclosure, and campaign support first; only then support compliant provider integrations. |
| 19 | Production chat/tool depth | REST fallback live | Keep rapid moderation, slow mode, follower mode, timeout, ban, and delete authoritative; activate realtime only with shared state. |
| 20 | Recommendation engine | Explainable ranking live | Use bounded candidate ranking and consented signals before any ML layer. |
| 21 | Pinned paid visibility | Not live | Create a crypto-only, moderation-controlled supporter spotlight that settles only after signed provider confirmation. |
| 22 | Shorts/search SEO flywheel | Partial clips/search live | Strengthen public metadata, canonical pages, clip sharing, and indexed category rails. |
| 23 | Watch inventory | Operational gap | Keep empty states honest and drive owner/creator ingestion rather than displaying fabricated media. |
| 24 | Ad stack | Foundation only | Build campaign, creative, rule, delivery, consent, reconciliation, and revenue allocation before enabling billing. |
| 25 | Cinema rights and encoding | Owner-only shell | Require rights record and published FastPix asset before playback; do not represent catalog-scale delivery. |
| 26 | Profiles and household UX | Viewer profiles present | Complete profile selection, kid-safe filtering policy, and per-profile personalization consent before household claims. |
| 27 | Multi-CDN control | FastPix data plane | Preserve FastPix separation; make multi-CDN a vendor/scale decision, not a false feature. |
| 28 | Notifications and personalization | Partial activity system | Add consent-bound notification preferences and followed-live delivery only after reliable event delivery exists. |
| 29 | Directory-grade discovery | Explainable ranker live | Build follow rails, fresh clips, category momentum, and consent-aware relevance signals before ML. |
| 30 | Content network near zero | Business-critical operating gap | Treat creator acquisition and content licensing as a launch program; code cannot manufacture an audience. |
| 31 | Crypto trust friction | Product and policy gap | Show exact customer total, separate provider fee, crypto settlement terms, creator share, and clear risk messaging without naming the provider in viewer UI. |
| 32 | Compliance surface | Scale gate | Retain audit trails and feature flags; require specialist legal, tax, KYC/AML, and jurisdiction review before custody or broad paid-ad launch. |
| 33 | Single-provider video dependency | Current design | Keep media adapter boundaries and webhook reconciliation; negotiate secondary delivery only after measured need. |
| 34 | Ads are not yet a business | Foundation only | Require approved advertiser, campaign budget, crypto payment confirmation, creative review, delivery qualification, and allocation ledger. |
| 35 | Mobile apps absent | Web is mobile-first | Deliver responsive web and installability; native app distribution is a separate product release. |
| 36 | Moderation/safety depth | Core actions live | Add audit visibility, escalation workflow, reporting, and operator instrumentation before higher-volume public growth. |
| 37 | Analytics and dashboard depth | Early-stage metrics live | Add creator earnings policy data, ad delivery status, campaign reporting, and clearly labeled reference values. |
| 38 | One money-leaves runbook | Existing material fragmented | Publish one concise operator runbook covering approval, destination verification, provider submission, reconciliation, incident holding, and the free-tier fallback. |

## Advertising program boundaries

The advertiser program is first-party and crypto-only. An advertiser may receive an owner-approved free launch flight with hard delivery and spend caps. Once a campaign converts to paid status, its budget must be confirmed through a signed crypto provider callback before delivery may consume it. Creative delivery remains consent-aware, content-rating-aware, frequency-limited, and auditable. Advertiser payment, campaign budget, qualified delivery, platform revenue, and any creator ad-revenue allocation are independent ledger events.

Creators do not receive a blanket share of gross ad revenue. Each campaign must define a versioned creator allocation policy before a qualified delivery event can be credited. The default is **no creator ad payout until the owner has approved a campaign-specific allocation**, preventing unfunded or forecast-based liabilities.

## Competitive design references

KICK publicly markets a 95/5 subscription split; this is the comparison point for Kryv’s transparent subscription and tip settlement policy.[1] Twitch documents ad scheduling, creator-controlled deferrals, and an advertising revenue-share model, which informs Kryv’s owner-approved ad rules rather than imposing an arbitrary schedule.[2] YouTube’s partner documentation establishes the broader distinction between ad-funded monetization and fan-funding; Kryv keeps both mechanisms separately auditable in crypto settlement terms.[3]

## Completion standard

Every implementation change must pass type checking, production build, targeted settlement tests, and a source-control review. Production activation requires a deployment verification and, for money movement, an immutable ledger and provider-side reconciliation record. The only permitted exceptions are the scale-dependent gates above, which remain visibly disabled until their stated requirement is complete.

## References

[1]: https://streamer.kick.com/ "KICK Streamer — 95/5 subscription split"
[2]: https://help.twitch.tv/s/article/ads-manager "Twitch Help — Ads Manager"
[3]: https://support.google.com/youtube/answer/72902?hl=en "YouTube Help — Partner earnings overview"

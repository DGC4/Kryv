# Kryv Product Reference Research

**Purpose:** Translate verified patterns from established entertainment platforms into an original Kryv product system. The references inform functional expectations and information architecture; Kryv will not copy their branding, protected media, or interface assets.

## Netflix: account-level identity with profile-level viewing context

Netflix documents that profiles provide household members their own personalized experience. Individual profiles can carry personalized recommendations, viewing activity, ratings, watch lists, language and playback preferences, notifications, a maturity level, viewing restrictions, and a profile lock. Netflix also describes a maximum of five profiles per account. [1] [2]

**Kryv implication:** Cinema should distinguish a logged-in account from an optional viewing profile. The initial Kryv release should establish profile selection, an active-profile session, an age/maturity preference, and profile-scoped history and saved-list rails. It should not market unlicensed catalog access or imply rights to content that Kryv does not distribute.

**Kryv rail system:** The Cinema landing page should make one cinematic editorial hero the highest-priority object, followed by profile-aware rails such as **Continue Watching**, **Your List**, **Because You Watched**, **Recently Added**, and eligible editorial/category rows. Every tile needs a keyboard and mobile-safe focus path, concise metadata, saved-state affordances, and an honest playback-status signal.

**Safety and privacy:** Profile switching must not expose private viewing histories across profiles. Mature-content preferences require both a product setting and server-side enforcement for protected playback surfaces. Analytics and personalized recommendations should use consent-aware events and be reflected in Kryv’s privacy disclosures before activation.

## Twitch: creator operations are organized around a live control plane

Twitch describes the Creator Dashboard as the centralized home for stream management, safety preferences, content organization, analytics, community management, monetization, and creator resources. Its Stream Manager functions as the immediate live control plane, while its broader dashboard uses a left-side information architecture, top-level search, and task-oriented sections rather than one undifferentiated creator page. [4]

**Kryv implication:** The existing one-page `/dashboard/live` should evolve into a durable creator workspace with a desktop sidebar and a mobile-first creator switcher. The home state should show **live/offline status, stream preview, viewers, followers, uptime, recent activity, and a single primary next action**. The Studio surface should then provide a structured live-control layout: preview, activity, moderation queue, chat, stream information, and quick actions. Existing FastPix ingest, HLS preview, and key rotation are protected implementation boundaries, not candidates for replacement.

Twitch’s documented analytics model distinguishes a 30-day overview, custom time ranges, stream summaries, discoverability, engagement, earnings, top clips, and recurring performance measures such as average viewers, time streamed, unique viewers, chat messages, clips, ad time, and discovery-source data. [5]

**Kryv implication:** Kryv should retain its current accurate live-session metrics and add transparent availability states for metrics it cannot yet calculate. It must never fabricate revenue, ad, or audience data. The next studio build should add date-range scaffolding, post-stream summaries, top content, and discovery signals only when they are server-backed.

Twitch’s moderation guidance puts protections, settings, enforcement history, and moderator permissions in the product, including follower/subscriber restrictions, non-moderator delay, link controls, rule acknowledgment, automated review, blocked terms, sanctions, and human-moderator oversight. [6]

**Kryv implication:** Kryv’s existing slow-mode, followers-only mode, bans, timeouts, and message-deletion endpoints are the base layer. The next operational layer should unify them in a moderation center with role assignment, visible action history, channel rules, safe defaults, and staged enforcement. Automated moderation must remain reviewable by a human and must not be represented as perfectly accurate.

For mobile creation, Twitch consolidates access through a single creator entry point and prioritizes status, preview, activity, a direct stream action, content, and analytics. [7]

**Kryv implication:** Mobile should not attempt to squeeze the desktop Studio into a narrow page. Kryv will provide a compact status-first dashboard, a bottom-sheet/segmented section switcher, direct access to live controls, and a clean return path to viewer mode.

## Kick: visible, configurable stream operations

Kick documents a creator dashboard that centers a real-time session-health status, live preview, current viewers, followers, subscriber count, uptime, direct stream-information editing, chat, moderation actions, an activity feed, and a configurable/reorderable workspace. [8]

**Kryv implication:** Kryv’s Studio should adopt the same operational clarity without copying Kick’s visual treatment: a status strip that reports only genuine live state, network or ingest concerns when available from FastPix, live preview, simple stream metadata controls, activity, and a compact mod-action feed. The designer must optimize the desktop composition for scanability and enable a practical mobile ordering rather than force every widget onto a phone viewport.

Kick’s safety model gives trusted channel roles control over timeouts, bans, message removal, chat modes, polls, and fulfillment. Its documentation also distinguishes fast, permission-checked chat commands from dashboard configuration. [9] [10]

**Kryv implication:** Kryv should add clear role capability boundaries and a command palette / slash-command interface only after every invoked action has a server-authorized implementation and an audit trail. The current raw channel-ID field for raids is not a creator-grade workflow; it must become a channel search-and-confirm experience with eligibility checks and transparent viewer behavior.

Kick’s current advertising guidance makes two constraints explicit: ad cadence can vary by context, and individual creator controls are limited to delay or early-trigger options around an upcoming scheduled break. It also separates platform-wide ads from a guarantee of direct ad-revenue payments to every creator. [11]

**Kryv implication:** Kryv must not hard-code “five ads per 15–30 minutes” as a blanket product behavior. Its first advertising system should model **inventory**, **eligibility**, **frequency caps**, **pod duration**, **scheduled break windows**, **creator defer/trigger rights**, **subscriber/ad-free exemptions**, **country and consent constraints**, and event-level reporting. Revenue claims must be disabled until a measured settlement model, provider agreement, and compliant accounting exist.

## YouTube: discovery is a quality-and-satisfaction product system

YouTube describes a logged-in homepage as a mix of personalized recommendations, subscriptions, and timely information. Its recommendation guidance emphasizes viewer behavior and feedback alongside channel reputation and content quality, while also giving viewers controls over search and watch history. [12]

**Kryv implication:** Kryv’s Watch and Live home pages should be built as transparent, composable rails—not an opaque “algorithm.” The first release should use explainable signals such as follows, saved history, completed/partial playback, current category, freshness, legitimate viewer engagement, and explicit preference controls. For sensitive content categories, trust and quality rules should override engagement-only ranking. A guest must see high-quality popular and editorial rails without being silently profiled.

YouTube’s analytics separates overview, reach, engagement, audience, revenue, and trends, making it clear which questions each measurement is meant to answer. [13] [14]

**Kryv implication:** Kryv will separate functional creator reporting into **Overview**, **Content**, **Audience**, **Discovery**, and later **Revenue**. It will use actual available measures—views, watch time, completion, return viewers, follower conversion, chat, and clips—rather than superficially copying foreign analytics labels. Limited data must be withheld or aggregated so low-volume creator data cannot expose individual viewers.

YouTube’s ad guidance describes ad *slots* as candidate opportunities rather than guaranteed impressions. It specifically favors natural content breakpoints over disruptive mid-sentence or mid-action interruptions and uses feedback to identify poor placements. [15]

**Kryv implication:** Kryv’s future VOD and Cinema monetization foundation should support creator-designated and automated natural breakpoints, pending actual content, rights, advertiser, consent, and measurement systems. A simple count of ads per interval is not a safe quality or revenue strategy.

## Google advertising platform: treat video ads as policy-governed inventory

Google Ad Manager’s documentation presents frequency caps as per-user rules that rely on a valid identifier, can combine multiple limits, and become less reliable where no identifier or user consent is available. Its video rules manage pre-, mid-, and post-roll positions, ad pods, break templates, targeted inventory, and frequency caps. [16] [17]

**Kryv implication:** Kryv’s initial advertising domain model must include a **viewer eligibility decision** before ad selection. A decision must evaluate subscription/ad-free state, age and content rating, territory, consent state, session identity availability, prior impressions, creative exclusions, and inventory availability. When a reliable ID or valid consent is absent, personalization and frequency-controlled monetization must be downgraded rather than silently bypassed.

Google’s video-ad guidance uses pods with explicit time budgets and applies frequency, competitive, advertiser, category, and brand-safety exclusions as part of filling a break. [18]

**Kryv implication:** A Kryv ad break is a scheduled or creator-triggered **opportunity**, not a promise to serve a fixed number of ads. The product should introduce an internal `ad_breaks` and `ad_impressions` ledger first, with preview/trigger/defer controls only for eligible creators, before a third-party ad server is connected. Each decision must be idempotent, auditable, and measured against delivery rather than request count.

Google’s current consent guidance makes clear that advertising personalization and measurement may require user consent depending on the visitor’s jurisdiction, and that users need clear disclosures and a practical withdrawal path. [19]

**Kryv implication:** Kryv cannot activate behavioral advertising or individualized measurement merely by adding an ad component. Consent preferences, a privacy-policy update, data-retention discipline, and regional behavior must precede activation. This is a product and legal prerequisite, not a cosmetic banner.

## FastPix: a lawful Cinema publishing and playback foundation

FastPix provides the video infrastructure Kryv needs for owner-controlled VOD publishing: URL, direct, and resumable uploads; adaptive HLS playback; separate media and playback identifiers; media-ready states; thumbnails, GIFs, timeline hovers, subtitles, audio transforms, watermarks, access control, and DRM options. [20] [21] [22]

**Kryv implication:** The owner control plane will model a Cinema title separately from its media assets. A title record can hold lawful editorial metadata, artwork, rating, genres, cast/crew credits, rights-window information, and publish state. A title can then link a primary feature asset, a trailer asset, subtitle/caption tracks, images, and a hover-preview asset. This prevents the frontend from treating a poster URL as a movie or exposing a video that is not ready or cleared for the viewer’s territory and entitlement.

**Kryv hover interaction:** Desktop tiles should use an explicit, delayed hover/focus affordance that reveals editorial metadata, controls, and a **muted trailer or preview** only when a ready, authorized preview asset exists. Browser autoplay requirements mean the preview is always muted and can fall back to an artwork card rather than failing. Touch devices will use an explicit details action, not a hover-only feature. [23]

**Software stack to use:** Continue using **FastPix Video on Demand** for source ingest, transcoding, HLS playback, analytics, preview/trailer assets, captions, and protected delivery. Use Kryv’s owner UI for catalog metadata, rights and publish-state approval, asset association, and ad-policy eligibility. Use the existing HLS player wrapper for custom playback, and introduce signed FastPix playback plus DRM only when premium/licensed catalog agreements require it. The actual copyright holder or authorized distributor must supply the feature, trailer, artwork, and distribution rights; Kryv must not ingest or display media that it is not authorized to use.

## Plisio: crypto payment and payout activation boundary

The provider name appears to be **Plisio** (`plisio.net`), rather than “Pellicio.” Plisio documents an invoice API, unique merchant order numbers, selected or allow-listed cryptocurrency codes, status callbacks, webhook verification using a provider-specified HMAC-derived `verify_hash`, transaction listing, and transaction types including invoices, cash-in, cash-out, and mass cash-out. [24] [25] [26]

**Kryv implication:** The crypto integration will never directly grant a subscription, publish a tip, or release a payout based on a browser redirect. Kryv will create an internal immutable payment intent first; request a Plisio invoice with a unique internal reference; store only provider IDs and normalized status; verify every callback; apply idempotent entitlement/balance logic only after the provider’s confirmed status; and retain an audit ledger. Supported payment currencies will be fetched from the provider’s supported-currencies endpoint and restricted by Kryv policy rather than assumed from a static UI list.

**Activation requirements:** To activate the live integration, the owner must supply a Plisio business account, register the exact public production domain, configure the provider callback URL, provide the user’s actual secret key through a secure connector configuration, decide customer-versus-platform network-fee policy, and determine the payout jurisdiction, customer disclosures, refund process, compliance review, and supported coins. Plisio recommends request-IP restriction; deployment must use an intentional egress approach before enabling that control. [27]

**Initial coin display:** The intended default coin shortlist can be **Bitcoin, Litecoin, Ethereum, and Dogecoin**, subject to Plisio availability, jurisdictional policy, wallet validation, and provider verification. It must not display a “withdraw” capability until the payout route is configured, verified, and separately approved.

## Sources

[1]: https://help.netflix.com/en/node/10421 "Netflix Help Center — How to create, edit, or delete profiles"
[2]: https://help.netflix.com/en/node/102377 "Netflix Help Center — Getting started with Netflix"
[3]: https://help.netflix.com/en/node/264 "Netflix Help Center — Parental controls on Netflix"
[4]: https://help.twitch.tv/s/article/creator-dashboard "Twitch Help — Creator Dashboard"
[5]: https://help.twitch.tv/s/article/channel-analytics "Twitch Help — Analytics Overview"
[6]: https://help.twitch.tv/s/article/setting-up-moderation-for-your-twitch-channel "Twitch Help — Setting Up Moderation for Your Twitch Channel"
[7]: https://help.twitch.tv/s/article/mobile-creator-mode "Twitch Help — Mobile Creator Mode"
[8]: https://help.kick.com/en/articles/7120642-understanding-your-kick-creator-dashboard "Kick Help — Understanding your KICK Creator Dashboard"
[9]: https://help.kick.com/en/articles/7109164-how-to-moderate-your-kick-chat "Kick Help — How to moderate your KICK chat"
[10]: https://help.kick.com/en/articles/7112979-kick-chat-commands "Kick Help — KICK chat commands"
[11]: https://help.kick.com/en/articles/15300424-advertising-on-kick-for-streamers "Kick Help — Advertising on KICK For Creators"
[12]: https://www.youtube.com/howyoutubeworks/recommendations/ "YouTube — Recommendations"
[13]: https://support.google.com/youtube/answer/9002587?hl=en "YouTube Help — Get started with YouTube Analytics"
[14]: https://www.youtube.com/creators/grow/understand-your-audience/ "YouTube Creators — Understand your audience"
[15]: https://support.google.com/youtube/answer/6175006?hl=en "YouTube Help — Manage mid-roll ad breaks in long videos"
[16]: https://support.google.com/admanager/answer/82242?hl=en "Google Ad Manager Help — Set frequency caps for a line item"
[17]: https://support.google.com/admanager/answer/9204132?hl=en "Google Ad Manager Help — Standard video ad rules"
[18]: https://admanager.google.com/home/resources/feature-brief-smarter-ad-breaks/ "Google Ad Manager — Earn more from your video content with Smarter Ad Breaks"
[19]: https://www.google.com/intl/en_uk/about/company/user-consent-policy-help/ "Google — Help with the EU user consent policy"
[20]: https://fastpix.com/docs/video-on-demand/overview "FastPix Documentation — Video on demand: overview"
[21]: https://fastpix.com/docs/getting-started/upload-and-play-your-first-video "FastPix Documentation — Upload and play your first video"
[22]: https://fastpix.com/docs/upload-videos/upload-videos-from-device "FastPix Documentation — Upload a video from a device"
[23]: https://fastpix.com/docs/video-on-demand/embed-a-video-in-your-app "FastPix Documentation — Embed a video in your app"
[24]: https://plisio.net/documentation/getting-started/introduction "Plisio Documentation — Introduction"
[25]: https://plisio.net/documentation/endpoints/create-an-invoice "Plisio Documentation — Create an invoice"
[26]: https://plisio.net/documentation/endpoints/transactions "Plisio Documentation — Transactions"
[27]: https://plisio.net/faq/how-to-connect-the-api "Plisio FAQ — How to connect the API"

### Plisio callback verification implementation detail

Plisio’s official invoice documentation states that invoice creation is a `GET` request to `https://api.plisio.net/api/v1/invoices/new` using a unique `order_number`, source amount/currency, optional selected or allow-listed crypto codes, and a callback URL. It reports the provider transaction ID and invoice URL on success. Callback processing must wait for a `completed` status; browser redirects are not settlement evidence. For a JSON callback, the documented Node verification method removes `verify_hash`, serializes the remaining callback object in provider order, and validates an HMAC-SHA1 digest using the merchant secret key with a timing-safe comparison. Kryv will request callbacks with `json=true`, store an internal payment intent before opening an invoice, and treat duplicate callbacks as idempotent. [25]

[25]: https://plisio.net/documentation/endpoints/create-an-invoice "Plisio Documentation — Create an invoice"

# Kryv Pressure-List Reconciliation Register

**Assessment date:** August 13, 2026
**Purpose:** Convert the supplied pressure list into evidence-backed engineering work, operating controls, and external readiness gates. This register is intentionally conservative: a gate is not marked complete merely because a blueprint or UI exists.

> **Decision rule:** Crypto money may move only on provider-confirmed, asset-denominated evidence. Product claims must not exceed the deployed topology, verified provider configuration, or completed reconciliation record.

## A. Money and operations

| Item | Verified present state | Classification and next control |
| --- | --- | --- |
| Free-tier host for irreversible payouts | API is a single free Render instance with a documented inline fallback. | **Open topology risk.** Treat withdrawals as low-volume owner-reviewed operations until an always-on API, isolated worker, and durable queue are deployed. |
| First live payout unreconciled | No first provider payout reconciliation record exists. | **Hard gate.** Do not call creator payouts battle-tested; perform one small owner-reviewed reconciliation before routine use. |
| Merchant secret rotation | Previous console exposure was recorded. | **Open critical action.** Rotate at Plisio, update only masked runtime configuration, redeploy, and record the rotation. |
| Request-IP configuration | Merchant request-IP is not a stable verified allow-list. | **Open critical action.** Do not invent an address; verify actual egress requirements with Plisio and use a stable deployment topology before relying on IP allow-list protection. |
| Redis, queue, worker, and realtime not deployed | Blueprint and code exist; free production topology does not. | **Open topology gate.** No claim of durable jobs, isolated payout execution, or push chat in current production. |
| Inline payout in API process | Inline guarded executor is enabled as free-tier fallback. | **Mitigated, not solved.** Atomic claim and non-retry semantics reduce duplicate-transfer risk; no high-volume or unattended operation is allowed. |
| Cold starts and UptimeRobot | Free service can sleep; monitor wakes the URL but is not infrastructure. | **Open topology gate.** Do not promise always-on settlement reception. |
| Creator economics and provider fees | 95/5 policy applies to confirmed crypto subtotal; provider invoice/chain fees are separate. | **Implemented with disclosure gap.** Add public 95/5 fee terms and payout fee explanation before marketing the split. |
| Ambiguous `executing` state | Executor claims before provider call and refuses blind retries. | **Mitigated, not automated.** Add owner-visible reconciliation hold state and automated alerting only after a durable worker exists. |
| Advertiser funding expansion | Owner-only crypto campaign funding is deployed; delivery remains gated. | **Contained.** Keep `ads_delivery` dark until a bounded funding, creative, consent, and reporting flight is reconciled. |

## B. Live product density and safety

| Item | Verified present state | Classification and next control |
| --- | --- | --- |
| Production push chat | Relay client reconnects only when a configured gateway exists; current topology uses REST synchronization. | **Open topology gate.** Explicit REST status is visible; deploy Redis-backed relay before claiming push chat. |
| Engagement density | Core engagement routes and creator settings exist. | **Partial product work.** Add retention-proven points, predictions, raids, and hype only after live inventory validates demand. |
| Clips loop | Authenticated viewer live clips, public clip details, and share links exist after provider processing. | **Partial product work.** Improve clip rails, share metadata, and clip discovery after source inventory grows. |
| Micro-cheer experience | Crypto tips exist, not a low-friction stored-value product. | **Intentional boundary.** Customer custody remains off; do not mimic Bits until compliance, custody, and reconciliation controls exist. |
| Extensions marketplace | No extension platform exists. | **Deferred.** Requires isolation, permissioning, moderation, and meaningful creator demand. |
| Emote culture | Basic chat expression is early. | **Deferred product layer.** Add channel/global emotes only with moderation, rights, and social inventory controls. |
| Multistream and incentives | Not deployed. | **Deferred.** Requires authorized outbound integrations and campaign economics; no public promise. |
| Moderation escalation | Owner chat remove/timeout/ban controls exist. | **Partial product work.** Add reporting, evidence retention, appeal workflow, and mod-audit UX before scale. |

## C. Discovery, inventory, and audience growth

| Item | Verified present state | Classification and next control |
| --- | --- | --- |
| Creator acquisition/content network | No verified active inventory flywheel exists. | **Business gate.** Product work cannot substitute for creator partnerships and initial programming. |
| Recommendation system | Directory/ranking and cached read paths exist; no behavioral ML system exists. | **Correctly deferred.** Instrument quality events first; build recommendations after sufficient inventory and privacy-safe data. |
| Watch inventory | Product surfaces exist; catalog depth is not proven. | **Business gate.** Maintain honest empty states and seed lawful creator/VOD inventory. |
| Cinema maturity | Owner-only rights/asset workflow exists; no Netflix-scale rights catalog or delivery control. | **Correctly constrained.** Do not market Cinema as a streaming catalog without rights, encoding, and availability evidence. |
| Shorts/search SEO | Clips and search surfaces exist; no proven SEO program. | **Partial product work.** Add clean clip metadata and canonical routes before broader acquisition work. |
| Pinned paid visibility | No Super Chat-style paid visibility movement is active. | **Deferred.** Requires transparent fee/reversal/moderation rules and creator consent. |
| Referrals/followed-live | Early follow/discovery capability exists. | **Partial product work.** Add referral fraud controls and notification consent before incentives. |
| Mobile apps | Responsive web only. | **Open product gate.** Do not represent native applications as available. |

## D. Advertising and business model

| Item | Verified present state | Classification and next control |
| --- | --- | --- |
| Ad business | Owner campaign and crypto funding control plane exists; no demand, delivery proof, or external network is live. | **Hard gate.** Ads are not a validated revenue source. |
| `ads_delivery` | Campaign delivery has approval, funding, window, rule, creative, consent, and flag controls. | **Correct gate.** Keep off until a bounded operator-run production flight is reconciled. |
| Creator ad share | Defaults to zero unless an explicit allocation and qualified delivery accounting exist. | **Correct liability control.** Do not make creator ad-share claims before measured delivery. |
| Core retention versus ads | Ads UI is owner-only, not a public monetization promise. | **Priority control.** Retention and live inventory take priority over expanding ad features. |
| Advertiser self-service | Owner-only by design. | **Deferred.** Self-service requires advertiser identity, compliance, billing, creatives review, and dispute processes. |

## E. Trust, compliance, and provider dependencies

| Item | Verified present state | Classification and next control |
| --- | --- | --- |
| Mainstream crypto friction | Crypto-only checkout and USD reference are implemented. | **Open product work.** Improve education and exact-amount checkout clarity without introducing card rails. |
| KYC/tax/compliance automation | Not implemented. | **Hard gate.** Do not expand custody, automated payouts, or broad advertiser self-service without legal/compliance architecture. |
| 95/5 trust claim | Policy is implemented, but payout proof and public fee terms still require completion. | **Marketing gate.** Do not use “like Kick” claims; state exact Kryv terms only after first reconciliation and public disclosure. |
| FastPix dependency | FastPix is the video data plane. | **Known provider dependency.** Preserve provider incident fallback language; multi-provider delivery is deferred. |
| Plisio dependency | Plisio is the only checkout/withdrawal provider. | **Known provider dependency.** Maintain signed event records, idempotency, secret rotation, and contingency documentation. |
| Cinema profiles/households | Not complete. | **Deferred.** Requires a rights/catalog strategy, not a cosmetic profile UI. |
| Creator analytics depth | Creator/owner dashboards exist but are early compared with mature platforms. | **Partial product work.** Add trusted metrics only when event delivery and retention are auditable. |

## F. Engineering and operating discipline

| Item | Verified present state | Classification and next control |
| --- | --- | --- |
| Register versus execution | A full gap register and this reconciliation record exist. | **Controlled.** Each item must remain marked build, gate, or dependency until independently verified. |
| Feature velocity versus topology | Commerce, payouts, and advertiser funding now outpace free-tier topology. | **Critical operating boundary.** Do not add higher-risk money automation before topology maturity. |
| Local LRU cache | Bounded in-process cache is active without Redis. | **Correct single-instance fallback.** Never use as shared state or multi-instance coordination. |
| DLQ/retry | Code and runbook exist; production queue is absent. | **Open topology gate.** Do not claim durable retry or dead-letter operation. |
| Automated test evidence | Builds and integration checks run; money-path CI coverage requires explicit enforcement. | **Hardening work.** Add test commands and test cases around fixed-point splits and payout non-retry behavior. |
| Operator muscle memory | Runbook now describes money movement. | **Open operational action.** First controlled payout is required to validate the runbook under supervision. |

## G. Competitive reality

Kryv cannot presently win on audience against Twitch or YouTube, on catalog against Netflix, or on ad demand against established networks. Its credible near-term position is crypto-only settlement discipline, transparent creator economics, FastPix-powered media delivery, and a curated creator/content program. That position remains an operating thesis until creators, viewers, and one reconciled payout prove it in live use.

## Release gate summary

| Gate | Current state | What changes it |
| --- | --- | --- |
| Routine creator withdrawals | Closed to “routine” classification | First reconciled payout; rotated secret; verified provider request-IP; durable isolated execution. |
| Ads delivery | Closed | Bounded crypto-funded flight with approved creative, consent, measured impressions, and reconciliation. |
| Push chat / durable jobs | Closed | Redis, realtime gateway, queue, and worker deployed and monitored. |
| Customer custody and scheduled payouts | Closed by policy | Separate compliance, reconciliation, and topology program. |
| 95/5 public marketing | Closed | Public terms/fee page plus verified payout evidence. |
| Audience-scale features | Deferred | Content inventory, creator demand, and measured retention justify the work. |

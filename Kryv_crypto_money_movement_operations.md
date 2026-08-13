# Kryv Crypto Money Movement Operations

**Status:** Production operating runbook
**Scope:** BTC, LTC, ETH, and DOGE only
**Settlement authority:** Provider-confirmed crypto amounts, never USD references
**Applies to:** Tips, subscriptions, creator payouts, and advertiser campaign funding

> **Core rule:** Kryv must not credit a creator, activate a paid campaign, or submit a provider withdrawal from a browser assertion, a USD quote, or an optimistic client state. A signed provider callback and an idempotent server-side record are required.

## 1. Current operating boundary

Kryv uses Plisio as the only payment provider. Checkout remains Kryv-branded; the customer selects BTC, LTC, ETH, or DOGE and pays the provider-issued invoice. Plisio's separately disclosed checkout commission is paid by the client. The invoice's USD amount is a quotation input only. The confirmed crypto subtotal is the accounting authority.

| Control | Required production state | Current operating rule |
| --- | --- | --- |
| `crypto_commerce` | Enabled for crypto invoice creation | Tips and subscriptions may create a provider invoice. |
| `creator_payout_requests` | Enabled | Creators can request a payout against an available asset-denominated balance. |
| `provider_withdrawals` | Enabled | An owner-approved request may enter guarded provider execution. |
| `PLISIO_WITHDRAWALS_ENABLED` | `true` | Runtime guard permits the provider withdrawal client to submit a withdrawal. |
| Customer wallet custody | Disabled | Do not market or operate deposits, stored balances, or internal custody. |
| Scheduled payouts | Disabled | No automated payout cadence is permitted. |
| `ads_delivery` | Owner-controlled, normally disabled until a bounded flight is ready | Paid campaign delivery cannot be enabled by funding alone. |

The present free-tier deployment has no production Redis queue, isolated worker, or realtime gateway. The API therefore uses the guarded inline owner-approval executor when the durable queue is unavailable. This is a deliberate degraded operating path, not a promise of high-volume payout throughput.

## 2. How value enters and settles

### 2.1 Tips and subscriptions

A viewer initiates a Kryv crypto checkout. The server creates an idempotent Plisio invoice and records the proposed payment intent. The page may display a USD reference and exact crypto invoice, but it does not write a creator balance. Plisio sends a signed JSON callback to the backend after payment confirmation.

The callback is independently verified, deduplicated using the provider event identity, and checked for internally consistent exact-crypto amounts. Kryv then applies the active versioned creator-fee policy. The current default for future tips and subscriptions is **95% creator / 5% Kryv platform share**. The provider checkout commission is excluded from this split because it is client-borne. The settlement writes immutable creator and platform ledger movements in the confirmed crypto asset.

| Stage | Server authority | Prohibited shortcut |
| --- | --- | --- |
| Invoice | Stored payment intent and provider invoice | Crediting from the displayed USD quote |
| Callback | Signature, event id, exact crypto terms | Treating a browser redirect as payment confirmation |
| Settlement | Active 95/5 policy and immutable movements | Blending the client-borne provider fee into creator/platform revenue |
| Creator balance | Confirmed asset movement only | Showing a guessed fiat conversion as a settleable balance |

### 2.2 Advertiser campaign funding

The Owner Console creates either a time-bounded **promotional** flight or a **paid** campaign. A paid campaign receives a Kryv-branded crypto funding invoice. It remains blocked until the signed Plisio callback reconciles the campaign funding record. The callback writes an idempotent `advertiser_funding_settled` advertising-revenue movement.

Advertiser funding does not automatically pay a creator. Creator advertising allocation is zero unless the owner explicitly configures an allocation and qualified delivery accounting exists. The 95/5 subscription/tip policy is separate from advertising revenue.

A campaign can serve only when all of the following are true: owner approval, valid delivery window, confirmed funding for a paid campaign or explicit promotional approval for a free flight, active campaign rule, active creative, relevant consent, and the `ads_delivery` gate. The campaign system must never be used to create open-ended free inventory or unverified advertiser debt.

## 3. How crypto leaves: owner-approved creator payout

### 3.1 Request and destination controls

A creator first saves a BTC, LTC, ETH, or DOGE destination. The server encrypts the full destination with AES-256-GCM. Clients and owner lists receive only the masked value. The owner reviews the payout profile before it may be used.

A creator payout request reserves an exact available asset amount. It is not a withdrawal and it must not be described as paid until the provider execution record reaches a submitted or completed state.

### 3.2 Owner decision and execution

The owner reviews a requested payout in **Owner Console → Finance Command**. Approval is auditable. In the current free-tier topology, the route attempts durable queue handoff first and, when no queue is available, invokes the guarded synchronous executor.

| Guard | Purpose |
| --- | --- |
| Feature flags and runtime gate | Stops payout execution immediately if commerce, payout request, provider withdrawal, or runtime withdrawal control is closed. |
| Profile review status | Prevents an unreviewed or rejected destination from receiving funds. |
| AES-256-GCM decryption only in server executor | Prevents exposure of a full destination in the browser or logs. |
| Fee estimate before submission | Records the provider fee expectation before the withdrawal call. |
| Atomic database claim | Ensures only one execution path can submit a given payout request. |
| Provider idempotency and immutable movement | Prevents duplicate provider calls and preserves the settlement trail. |
| Stored provider transaction URL/id | Provides the reconciliation reference after submission. |

### 3.3 Required first-live reconciliation procedure

The first live payout is not a routine test. It is a controlled production reconciliation and must use a small amount that the owner has independently approved.

1. Confirm the owner-reviewed profile is approved and shows a masked destination.
2. Confirm the payout request amount, requested crypto asset, and creator available balance.
3. Confirm Plisio API withdrawals remain enabled in the merchant console.
4. Confirm the backend health capability reports the withdrawal runtime gate as enabled.
5. Confirm the production feature flags above remain enabled and custody/scheduled payouts remain disabled.
6. Approve the request once. Do not refresh-and-reapprove while a result is pending.
7. Record the provider payout id, transaction URL, submitted exact amount, estimated fee, actual provider response, and destination proof in the reconciliation log.
8. Reconcile the immutable Kryv movement to the provider record before allowing the next payout.

> **Stop immediately:** If a callback is missing, a provider id is absent, the request is left in an uncertain status, the fee differs materially, or a second approval appears possible, place the request on hold. Do not resubmit or manually pay around the ledger.

## 4. Incident and rollback actions

| Condition | Immediate action | Follow-up |
| --- | --- | --- |
| Suspected duplicate or uncertain payout | Disable `provider_withdrawals`; preserve request and event records | Reconcile the provider transaction before any retry. |
| Provider callback failure | Disable `crypto_commerce` if settlement integrity is at risk | Inspect signed event records and provider callback configuration. |
| Merchant secret exposure | Rotate the Plisio secret, update the masked runtime variable, redeploy, and re-check health | Remove the legacy secret fallback after the new secret is verified. |
| Request-IP rule ambiguity | Do not change the merchant rule blindly | Confirm the actual provider callback and API topology, document the decision, then apply a minimal allow rule only if required. |
| Free-tier cold start or outage | Do not approve payouts while operator visibility is impaired | Use health monitoring only as a wake-up aid; it is not an always-on payout guarantee. |
| Queue/realtime unavailable | Keep API fallback available; do not claim live relay or isolated job delivery | Upgrade the topology before relying on high-volume payouts or chat delivery. |

## 5. Required records and monthly review

The owner must retain the provider callback event id, Kryv payment or funding id, fee-policy version, exact asset amounts, provider payout id/transaction URL, and the related audit entry for every settled flow. Review the active fee-policy rows, operational flags, provider secret age, callback success rate, unsettled campaign funding, and creator liabilities at least monthly.

The owner should also review whether the free-tier single-process path remains proportionate to volume. Increasing payout, advertiser, or creator activity without an always-on API, Redis-backed queue, isolated worker, and production realtime gateway is an operating-risk escalation, not a feature toggle.

## 6. Explicit non-goals and prohibited claims

Kryv does not currently provide customer crypto custody, scheduled creator payouts, fiat cards, Stripe, a global realtime relay, ad-network demand, automatic advertising creator revenue allocation, multi-CDN control, KYC/tax automation, or guaranteed uninterrupted free-tier infrastructure. Do not represent those capabilities as active until their specific readiness gates are implemented and verified.

The platform may display USD as a reference for consumers and advertisers, but actual settlement, creator liabilities, campaign funding, and withdrawals remain crypto-denominated and provider-confirmed.

## 7. Repeatable deployment-readiness check

Run the following command after every production deployment and before an owner begins a controlled payout or enables an advertiser flight:

```bash
pnpm run verify:production-readiness
```

The command performs a **read-only** request to the deployed `/health` endpoint. It verifies an `ok` service status and the expected provider-withdrawal runtime state. It never creates an invoice, changes a feature flag, calls the withdrawal provider, or writes a database record.

| Command mode | Meaning | Expected result on the present topology |
| --- | --- | --- |
| `pnpm run verify:production-readiness` | Confirms the public runtime health contract and documents any free-tier boundary. | Passes only when health is `ok` and provider withdrawals report the expected runtime state. |
| `REQUIRE_DURABLE_TOPOLOGY=true pnpm run verify:production-readiness` | Enforces an always-on, queue-backed deployment requirement. | Intentionally fails while Kryv reports `free-tier-fallback`. This is a deployment gate, not an outage. |

> **Operator rule:** A passing free-tier readiness check does not prove stable egress, Redis, durable jobs, an isolated worker, or continuously available callback reception. Those claims require the strict topology gate to pass after the corresponding infrastructure is deployed.

## 8. Viewer safety report review

Authenticated viewers may report an eligible live-chat message with a bounded reason. Kryv captures the message identifier, preserved message content, reason, reporter, subject, and audit correlation in a durable moderation case. The owner reviews open cases in **Owner Console → Safety** and chooses **Resolve** or **Dismiss** once.

A safety case is not silently overwritten. The original evidence remains attached to the review record, and the owner decision is written to the audit ledger. This workflow is a reporting and review control; it does not replace emergency moderation actions such as deleting a message, timing out an account, or banning a user.

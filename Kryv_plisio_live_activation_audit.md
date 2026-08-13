# Kryv Plisio Live Activation Audit

**Audit date:** 2026-08-12 EDT

## Current merchant-site observations

The authenticated Plisio merchant site is named **KRYV** and uses the **Custom** integration type. The live settings page currently exposes blank Status URL, Success URL, and Failed URL fields. The approved public payment currencies shown are Bitcoin, Litecoin, Dogecoin, and Ethereum. The configured invoice expiry is 30 minutes. The commission responsibility is set to **Client**, and White-label payment processing is already enabled.

The merchant page currently displays an underpayment allowance of **5%**. That is incompatible with Kryv's exact, server-authoritative settlement requirement: a 95% payment could be considered paid by the provider. The recommended safe setting is **0%**, so only fully settled provider-confirmed invoices create entitlements or creator ledger movements.

No provider secret or confidential value is recorded in this document.

## Verified provider behavior

Plisio documents Status URL as its server-to-server response endpoint, while Success URL and Failed URL are customer browser-return destinations. An invoice-specific `callback_url` can override the saved Status URL. With `json=true`, Plisio documents JSON callbacks signed by `verify_hash`; Kryv already appends that query parameter and verifies a HMAC-SHA1 over callback fields with `verify_hash` excluded.

For White-label invoices, Plisio returns provider-native checkout fields including `qr_code`, `invoice_commission`, `invoice_sum`, and `invoice_total_sum`. With **Client** commission responsibility, `invoice_sum` is the merchant amount and `invoice_total_sum` is the merchant amount plus the client-borne Plisio commission. Kryv must persist these values for audit, but creator revenue should be calculated only from the provider-confirmed merchant amount, never by guessing from a user-entered USD quote.

## Proposed safe merchant settings

| Setting | Proposed value | Reason |
|---|---|---|
| Status URL | `https://kryv-backend.onrender.com/api/webhooks/plisio?json=true` | Signed server-to-server settlement callback |
| Success URL | `https://kryv-frontend.onrender.com/?payment=success` | Safe generic browser return fallback |
| Failed URL | `https://kryv-frontend.onrender.com/?payment=failed` | Safe generic browser return fallback |
| Commission responsibility | Client | Customer pays the documented White-label 1.5% provider commission |
| Supported currencies | BTC, LTC, ETH, DOGE only | Kryv's approved crypto-only catalog |
| Expiry | 30 minutes | Matches current application request behavior |
| Underpayment allowance | 0% | Avoids granting value for partial payments |
| White-label | Enabled | Supports Kryv-branded checkout and QR fields |
| Provider API withdrawals | Disabled until activation gates pass | Preserves protected payout controls |

## Activation boundary

Merchant-console settings are not the same as authorizing a real payment or on-chain withdrawal. Commerce may be enabled only after the code persists exact provider callback figures and the user has approved a controlled test invoice. Provider withdrawals remain disabled until their documented activation gates and payout reconciliation test pass.

## Sources

1. [Plisio — Setting shop](https://plisio.net/documentation/getting-started/setting-shop)
2. [Plisio — Create an invoice](https://plisio.net/documentation/endpoints/create-an-invoice)
3. [Plisio — Manage invoice updates and cash-in](https://plisio.net/documentation/endpoints/manage-invoice-updates-and-cash-in)
4. [Plisio — How to enable White Label](https://plisio.net/faq/how-to-enable-white-label)

## Approved merchant-console changes in progress

With the owner’s explicit confirmation, the merchant console now has the following unsaved values entered for the KRYV site:

| Setting | Entered value |
|---|---|
| Status URL | `https://kryv-backend.onrender.com/api/webhooks/plisio?json=true` |
| Success URL | `https://kryv-frontend.onrender.com/?payment=success` |
| Failed URL | `https://kryv-frontend.onrender.com/?payment=failed` |

The remaining approved edits are underpayment tolerance to `0%`, QR amount support on, and provider API withdrawals disabled. The settings will not take effect until the merchant console Save action is used.

## Merchant control verification

The provider-level **Disable withdrawal via API** control has been saved and is visibly enabled. The **White-label payment processing** and **Add invoice amount to QR-code** controls are also visibly enabled. The approved client commission responsibility and BTC/LTC/ETH/DOGE currency set remain intact.

The Status, Success, and Failed URLs have been re-entered after the provider UI reset unsaved fields while toggles were being changed. The final remaining unsaved form change is the underpayment tolerance of `0%`, after which the callback, return URLs, and tolerance will be saved together.

## Confirmed live merchant settings

The final approved merchant-settings save completed. The visible controls now confirm: **Client** pays the checkout commission; BTC, LTC, DOGE, and ETH are enabled; invoice expiry is 30 minutes; **underpayment tolerance is 0%**; White Label is enabled; QR codes include the invoice amount; and **Disable withdrawal via API** is enabled. The callback and browser return URLs were saved in the same final action.

No payment was created, no customer was charged, and no on-chain withdrawal was initiated during this configuration work.

A subsequent read-only production review reconfirmed that the saved Status, Success, and Failed URLs use the Kryv backend and frontend domains, respectively, and that the commission payer remains **Client**. No merchant secret value was copied, changed, or recorded during this review.

## Production reachability probe

An initial non-mutating GET probe to `https://kryv-backend.onrender.com/api/webhooks/plisio?json=true` reached Render's **Application loading** page, demonstrating that the service is sleep-prone. After the instance completed its wake-up cycle, a second non-mutating probe returned HTTP `200` with the expected `Kryv crypto settlement receiver ready` response. The endpoint is reachable when warm, but the free-instance cold-start behavior still fails the required paid, always-on runtime condition. No payment intent, callback, settlement, payout, or withdrawal was created during either probe.

The authenticated production Render project currently lists only two services: **Kryv-backend** (Node, Oregon) and **Kryv-Frontend** (Static, Global). The realtime gateway, isolated worker, cache, and queue services defined by the repository blueprint have not yet been deployed in this project. This topology cannot yet meet the requested five-service, paid always-on production standard.

The backend is automatically deploying commit `0612b80` and the runtime console identifies it as a **Free** instance with an explicit inactivity spin-down warning. The rendered environment list showed masked values for `ACCESS_TOKEN`, `ALLOWED_ORIGINS`, `DATABASE_URL`, `FASTPIX_WEBHOOK_SECRET`, and `JWT_SECRET`, followed by `Plisio_Token` and `SECRET_KEY`. The application requires `PLISIO_SECRET_KEY`, `PLISIO_CALLBACK_URL`, and `KRYV_APP_URL` before it will create crypto invoices; the current visible names therefore do not demonstrate checkout readiness. The environment view also did not show the required cache, queue, realtime, or payout-encryption variables. No secret values were viewed, exported, changed, or recorded.

A read-only query against the production Neon branch confirms that `crypto_commerce`, `creator_payout_requests`, `scheduled_payout_requests`, and `provider_withdrawals` are all `false`. This is the correct protected state while the environment-variable, paid-runtime, five-service topology, and controlled invoice verification gates remain incomplete.

## Customer-wallet production foundation

On 2026-08-12, the production Neon main branch received the additive **customer-wallet ledger** migration after isolated-branch validation and explicit approval. The production verification confirms that the wallet balance, immutable movement, and permanent deposit-address structures exist, while the `customer_wallet_custody` feature flag remains **false**. The implementation generates White Label provider-backed BTC, LTC, ETH, and DOGE deposit addresses only when this custody gate is enabled, validates the signed `pay_in` callback, confirms the callback amount and provider commission arithmetic, matches the callback to the active address and internal deposit identity, and then records exactly one customer wallet credit.

Customer-wallet-funded creator support is also feature-gated. When explicitly activated only after reconciliation, it atomically debits the confirmed customer balance, records the completed tip, writes the creator gross credit and any platform-fee debit, records the separate platform-revenue movement, and credits the creator net balance. The deterministic fixed-point settlement check, API build, and frontend production build passed after these changes. Neither customer-wallet custody, crypto commerce, creator payout requests, scheduled payouts, nor provider withdrawals was enabled as part of this work. No customer deposit, wallet debit, or on-chain withdrawal was initiated.

Before activating `customer_wallet_custody`, the owner must deploy the code to the paid always-on topology, configure the production callback and provider key variables, verify an actual signed provider `pay_in` callback end-to-end with a controlled deposit, reconcile the provider treasury balance to the customer-wallet liability ledger, exercise the customer support and incident procedures, and keep `provider_withdrawals` disabled until the separate documented payout reconciliation gate passes.

## Deployment configuration recheck

After the `de33055` production release deployed successfully to both existing Render services, a read-only environment review confirmed that the backend currently exposes `Plisio_Token` (supported by the release for a controlled key-name migration) but does **not** expose the required `PLISIO_CALLBACK_URL`, `KRYV_APP_URL`, `KRYV_CACHE_REDIS_URL`, `KRYV_QUEUE_REDIS_URL`, `CREATOR_PAYOUT_ENCRYPTION_KEY`, or `KRYV_REALTIME_TOKEN_SECRET` names. The frontend does **not** expose `VITE_REALTIME_URL`. The only deployed services are the free-tier backend and static frontend; the always-on realtime gateway, worker, cache, and queue are not yet provisioned. These omissions leave all live-money controls safely inactive, but they block a production activation of customer deposits, wallet spending, real-time fan-out, and creator commerce.

## Interim external availability safeguard

A UptimeRobot HTTP/S monitor was created for `https://kryv-backend.onrender.com/api/webhooks/plisio?json=true`. It is configured on the account’s available five-minute interval with e-mail notification enabled and uses the application’s read-only settlement-receiver GET probe. The monitor is initially preparing its first check. This reduces cold-start risk for the current free backend but does not change the documented production requirement for paid always-on API, realtime, worker, cache, and queue services before enabling funds movement.

The UptimeRobot safeguard completed its initial verification successfully. The callback health monitor is **Up**, checks every five minutes from North America, reports no incidents, and recorded recent response times between 119 ms and 189 ms (154 ms average). This confirms the read-only health probe is externally reachable under the free-tier safeguard; it does not authorize customer deposits, wallet spending, or any payout execution.

## Explicit free-tier withdrawal lock

The deployed Render backend now has `PLISIO_WITHDRAWALS_ENABLED=false` configured explicitly. Render rebuilt and redeployed the backend successfully after the change, and the runtime reported that the service is live. This is an additional defense-in-depth control: provider withdrawals remain disabled even if any future code or owner control is misconfigured. The free-tier availability limitation remains unchanged, and wallet custody, internal wallet spending, crypto commerce, creator payout requests, and scheduled payout requests remain feature-flagged off.

## Non-monetary public-surface check

After the free-tier safety redeploy, the deployed Live discovery and Watch surfaces rendered successfully in a browser. The public routes showed their designed zero-inventory state without error: no active live channels and no processed Watch uploads. This is expected content state rather than a failed client render. The application navigation, search inputs, category controls, and creator-upload entry point were present; no payment or custody action was invoked during this check.

The deployed public API was verified after the safety redeploy. `GET /api/discover/summary`, `GET /api/channels`, and the read-only `GET /api/webhooks/plisio?json=true` probe each returned HTTP 200. Discovery returned the configured category rail with zero current live channels; the channel read path returned the two existing non-live channels; and the settlement receiver returned its expected readiness response. No authenticated action, invoice, deposit, wallet movement, or payout was triggered.

The existing public channel route `/live/fano` was also verified. Its explicit non-live fallback rendered correctly with the creator identity, category, engagement balance, and chat history instead of a blank player or client failure. The standalone realtime gateway remains intentionally un-deployed on the free tier because `VITE_REALTIME_URL` and the dedicated gateway service are absent; the deployed client therefore continues to use its REST read path rather than claiming active WebSocket delivery.

## Provider configuration recheck

The authenticated KRYV Plisio site is configured as a Custom integration. The saved callback and customer-return URLs point to the Kryv backend and frontend, respectively, and the customer is selected as the commission payer. The site also currently has an API request-IP allow-list configured. The provider secret was visible in the merchant UI during this inspection; it must be rotated before any deployment configuration step, and its replacement must never be copied into source control, chat, or logs.
The saved KRYV provider controls were rechecked: BTC, LTC, DOGE, and ETH are the supported currencies; invoice expiry is 30 minutes; underpayment tolerance is 0%; the customer pays the provider commission; White Label processing and exact invoice amount in the QR code are enabled; provider withdrawal by API is disabled. The optional QR-currency-hash display, high-risk-business declaration, and alternative payment link are not enabled. These settings were observed without modification.
A read-only production database check confirmed that `crypto_commerce`, `customer_wallet_custody`, `creator_payout_requests`, `scheduled_payout_requests`, and `provider_withdrawals` are all disabled. This preserves the intended activation order: only live invoicing may be considered after provider-key rotation, server configuration, and a controlled callback test; stored customer balances and every withdrawal/payout path remain blocked.
The merchant-profile uploader is accessed from the Site profile control within the KRYV settings form; an assumed standalone profile URL does not exist. No merchant setting was changed during this navigation check.
A square Kryv K monogram merchant logo was created as a transparent PNG and uploaded to the authenticated Plisio KRYV site profile. The profile was saved with the Kryv name and frontend URL unchanged. No payment, payout, callback, or withdrawal setting was changed while applying the brand asset.
The Render backend currently has the explicit `PLISIO_WITHDRAWALS_ENABLED=false` lock and an application `SECRET_KEY`, but the inspected environment list does not show the explicit `PLISIO_SECRET_KEY`, `PLISIO_CALLBACK_URL`, or `KRYV_APP_URL` names required for Plisio invoice execution. The provider secret observed in the merchant panel must be rotated and entered only through Render’s masked secret field; it is not recorded in this audit.
The backend environment editor is prepared to add only non-secret runtime values: `PLISIO_CALLBACK_URL` will use the existing signed Kryv endpoint, `KRYV_APP_URL` will use the deployed frontend origin, and `PLISIO_ALLOWED_COINS` will explicitly constrain the provider adapter to BTC, LTC, ETH, and DOGE. The existing withdrawal disable variable will remain unchanged.
The backend environment editor now contains pending non-secret values for `PLISIO_CALLBACK_URL=https://kryv-backend.onrender.com/api/webhooks/plisio?json=true` and `KRYV_APP_URL=https://kryv-frontend.onrender.com`. The existing `Plisio_Token` remains masked and unchanged, and the provider-withdrawal lock remains present. These edits have not yet been saved or deployed.
The Render backend now has explicit non-secret Plisio runtime configuration: the signed callback URL, the Kryv frontend origin for trusted customer returns, and the BTC/LTC/ETH/DOGE allow-list. Render rebuilt successfully and reported the backend service live. The existing masked `Plisio_Token` and the explicit `PLISIO_WITHDRAWALS_ENABLED=false` lock were preserved; no withdrawal, payout, wallet-custody, or commerce feature flag was changed in this deployment.

## Controlled crypto-commerce activation

The production `crypto_commerce` flag is now enabled. A follow-up database query confirmed the strict boundary remains intact: customer wallet custody, creator payout requests, scheduled payout requests, and provider withdrawals are all disabled. After the runtime configuration deployment, the signed callback-receiver probe returned HTTP 200 with the expected Kryv readiness response. This activation permits the existing Kryv-branded crypto invoice path to request provider invoices in USD and settle only after a signed Plisio callback; it does not permit stored customer deposits, wallet-funded transfers, or any outbound provider withdrawal.
A direct review of the KRYV Plisio settings confirmed that the merchant secret must be rotated and reinstalled into the explicit backend secret variable. It also revealed a non-compatible API request-IP allow-list for the current free Render runtime: the configured fixed ranges do not provide a stable outbound source allow-list for a sleeping managed service. Before treating invoices as stable, the key must be rotated, the runtime secret field updated, and the request-IP restriction reconciled with a stable egress strategy or removed while relying on the rotated secret and signed callbacks.
The Plisio secret was copied through the authenticated browser’s native clipboard control for secure transfer to Render’s masked environment field. No secret value is retained in this audit or entered into a command. The backend editor is prepared to add `PLISIO_SECRET_KEY` alongside the legacy masked key before a controlled redeploy.
The backend now has the documented `PLISIO_SECRET_KEY` environment name populated through a browser-native secure clipboard transfer from the authenticated merchant settings page. Render confirmed the environment update and started a redeploy. The legacy `Plisio_Token` was retained temporarily for rollback compatibility; the application prefers the explicit key.
The KRYV Plisio request-IP field has been cleared in the merchant settings form because the previously configured network ranges are not attributable to the managed Render service. The signed callback URL, customer-paid fee rule, supported crypto rails, white-label settings, and provider-withdrawal lock were not modified. The change remains pending until the merchant form is saved and re-verified.

The merchant form was then saved. At save time, the provider controls visibly retained the Client commission payer; BTC, LTC, DOGE, and ETH currency set; 30-minute invoice expiry; zero-percent underpayment tolerance; White Label processing; QR invoice amount support; and Disable withdrawal via API. The request-IP setting was re-opened and verified as empty, completing this control update.

## Post-secret deployment verification

Render completed deployment `dep-d9uggg3m8hqs73cmb55g` successfully after the explicit `PLISIO_SECRET_KEY` value was added through the masked environment editor. The service logs report the HTTP server listening and the primary endpoint live. A non-mutating probe of `https://kryv-backend.onrender.com/api/webhooks/plisio?json=true` then returned the expected readiness body and HTTP `200`.

A read-only Neon query against production reconfirmed the intended feature boundary: `crypto_commerce=true`; `customer_wallet_custody=false`; `creator_payout_requests=false`; `scheduled_payout_requests=false`; and `provider_withdrawals=false`. The merchant source-IP field is saved empty because the previous ranges did not match Render’s stable egress, while callback signatures and the rotated-equivalent secret remain the authorization controls. No invoice, customer charge, wallet credit, payout request, or on-chain withdrawal was created in this verification.

A masked Render environment-name review confirmed the explicit `KRYV_APP_URL`, `PLISIO_ALLOWED_COINS`, `PLISIO_CALLBACK_URL`, and `PLISIO_SECRET_KEY` variables are present alongside the temporary `Plisio_Token` fallback and the `PLISIO_WITHDRAWALS_ENABLED` lock. The three subscription-price variables, the AES-256-GCM payout encryption key, and the realtime-token secret are not yet present; the isolation services and their Redis URLs are also still absent.

The backend environment editor is prepared to add three USD-reference subscription tier prices (`6.99`, `14.99`, and `24.99`) plus a fresh base64-encoded 32-byte creator-payout encryption key and a separate high-entropy realtime authentication secret. These values are configuration for the already-coded checkout and protected payout-profile paths; no customer transaction, wallet custody, or provider withdrawal will be enabled. Generated secrets are retained only in local protected temporary files until immediately placed in masked Render fields, then removed.

The backend editor now contains pending tier-price entries for `KRYV_CRYPTO_SUB_TIER_1_USD`, `KRYV_CRYPTO_SUB_TIER_2_USD`, and `KRYV_CRYPTO_SUB_TIER_3_USD`, plus the `CREATOR_PAYOUT_ENCRYPTION_KEY` field populated from a newly generated valid 32-byte key. These pending values have not yet been saved or deployed. No secret value is recorded in this audit.

The editor now also contains a separate `KRYV_REALTIME_TOKEN_SECRET` field populated from a newly generated high-entropy value. Before deployment, the visible pending configuration comprises only three subscription USD-reference amounts and these two security keys. The existing Plisio secret, callback URL, allowed-coin list, application URL, legacy fallback key, and provider-withdrawal lock are left untouched.

Render saved this configuration set and completed backend deployment `dep-d9uglqvavr4c73afglu0` successfully. The process started and the service was reported live. This closes the subscription-tier configuration and payout-destination encryption-key gaps in the deployed API. It does not enable wallet custody, payout requests, scheduled payout requests, or provider withdrawals; the realtime gateway remains un-deployed until cache and queue services are provisioned.

## Reliability and realtime delivery hardening

The repository now includes a bounded durable-job policy: retryable asynchronous work uses four total attempts with deterministic one-, two-, and four-second backoff before entering a durable dead-letter list. Malformed jobs and all payout jobs blocked by the activation gates are preserved as dead-letter records rather than being silently discarded. The companion `Kryv_durable_queue_operations.md` document specifies operator review, replay, monitoring, and prohibited raw-payload replay practices. The API build and deterministic queue-policy check passed.

The dedicated `KRYV_REALTIME_TOKEN_SECRET` now backs short-lived scoped realtime tokens. The gateway still accepts existing session tokens during client migration, so this security improvement does not break deployed browser sessions. Engagement actions now publish an `engagement.updated` invalidation event after successful responses, and the live channel client immediately refreshes its authoritative engagement state when that event arrives. The scoped-token check, API build, and frontend production build passed. The separate Redis/WebSocket service remains un-deployed, so production continues to use its REST refresh fallback until the repository blueprint is provisioned.

## Released revision

The reliability and realtime hardening release was committed and pushed to `DGC4/Kryv` main as `c0fbd1703f8a445a2155a096df36b98fec113c6f` (`feat: harden Kryv realtime and durable delivery`). Render auto-deployed this revision successfully, reporting the server listening and the service live. A post-release non-mutating probe of the Plisio settlement receiver returned the expected readiness response with HTTP `200`; the working tree is clean. The production database safety boundary remains: crypto commerce on, while customer wallet custody and all payout/withdrawal controls remain disabled.

## Go Live repair and free-tier product releases

The deployed creator Studio’s Go Live route was reproduced in the authenticated browser and found to fail as a blank/black screen because of a runtime import error. The targeted repair was committed as `fb413db` (`fix: restore Go Live creator dashboard render`), automatically deployed to both existing Render services, and rechecked in the deployed dashboard. The page now renders normally and the Go Live entry control no longer takes the creator to a blank screen.

A subsequent guarded payout-execution implementation was committed as `e068e47` (`feat: activate owner-approved crypto payout execution`). It adds Plisio fee estimation, encrypted AES-256-GCM destination verification, database-backed request claiming before an irreversible provider call, provider-operation idempotency, immutable held-balance settlement movements, and an owner-approval-to-durable-job handoff. This code is present and deployment-verified, but it remains **non-executable** in the current topology because the database flag `provider_withdrawals` is false, the backend runtime health reports `providerWithdrawalsRuntimeEnabled=false`, Plisio’s API-withdrawal block remains enabled, and no durable queue or isolated worker is deployed. The current free-tier operating decision preserves these locks; no payout request, provider operation, or on-chain transfer was initiated.

The creator-facing crypto subscription tier experience and a non-sensitive operational readiness endpoint were released as `cbba0d4` (`feat: expose readiness and crypto subscription tiers`). The live channel support panel now exposes tiers 1–3, presents a Kryv-branded crypto-only checkout action, and makes clear that the resulting provider-confirmed crypto amount is authoritative. Customer Wallet support is visibly unavailable while customer-wallet custody remains disabled. The backend readiness endpoint confirms the actual runtime capability state without disclosing secrets.

The bounded no-Redis cache fallback was released as `660f02a` (`feat: add free-tier shared cache fallback`). In the single-process free deployment, short-lived discovery data now uses a 256-entry local LRU fallback rather than re-querying hot read paths for every simultaneous request. This is deliberately a degradation aid, not a replacement for shared Redis; it does not provide multi-instance cache coherence, durable jobs, presence, or realtime fan-out. The deterministic local-cache check and API build passed before release. Render’s static frontend and backend both report this revision deployed live.

Final non-mutating verification after the latest release returned HTTP `200` for `/health` and the signed Plisio settlement-receiver health endpoint. `/health` correctly reports `mode: free-tier-fallback`, `sharedCache: false`, `durableQueue: false`, and `providerWithdrawalsRuntimeEnabled: false`. The final read-only Neon production query confirms `crypto_commerce=true` while `customer_wallet_custody=false`, `creator_payout_requests=false`, `scheduled_payout_requests=false`, and `provider_withdrawals=false`.

> The free-tier deployment now has stronger safe degradation and a corrected creator path, but it is not an always-on money-movement topology. Do not enable customer custody, payout requests, provider withdrawals, or scheduled payouts until a stable queue, isolated worker, provider request-IP strategy, and controlled provider payout reconciliation are available.

## Provider permission recheck after owner change

The authenticated KRYV provider settings page was reopened after the owner reported enabling API withdrawals. The non-secret settings visible in the page confirm the Kryv callback URL, frontend success and failure URLs, Client-borne provider commission rule, and an empty request-IP restriction. The merchant secret was exposed by the provider UI during this visual recheck and is therefore considered compromised for operational hygiene; it must be rotated in Plisio and replaced through Render’s masked `PLISIO_SECRET_KEY` field before treating the live payout path as stable. No secret value is recorded here.

The provider withdrawal-control recheck shows the **Disable withdrawal via API** switch visually off, which is consistent with the owner enabling provider API withdrawals. The Render environment list contains the masked `PLISIO_WITHDRAWALS_ENABLED` variable along with the explicit Plisio key, callback URL, encryption key, and subscription variables. A read-only Neon query still shows `creator_payout_requests=false`, `provider_withdrawals=false`, `customer_wallet_custody=false`, and `scheduled_payout_requests=false`; crypto commerce remains enabled. No secret or masked value is recorded.

After the owner-enabled Plisio API-withdrawal control was confirmed off and the production `creator_payout_requests` plus `provider_withdrawals` feature flags were activated, Render completed the runtime redeploy successfully. The public readiness probe nevertheless continued to report `providerWithdrawalsRuntimeEnabled=false`, so the final runtime value requires correction and re-verification before any owner approval can submit an on-chain provider payout. This diagnostic does not change the database activation and did not create a payout request or withdrawal.

## Verified live payout activation

On **2026-08-12 EDT**, the final runtime gate was corrected. The Render environment value for `PLISIO_WITHDRAWALS_ENABLED` was explicitly read back as `false`, overwritten with the exact value `true`, saved, and deployed as `dep-d9uhunm417fc7388lvs0` from revision `a0d8c1e` (`feat: execute approved payouts without queue`). Render reported a successful build, server start, and service-live event. The post-deploy public readiness probe returned HTTP `200` with the authoritative capability payload below:

```json
{"status":"ok","mode":"free-tier-fallback","capabilities":{"sharedCache":false,"durableQueue":false,"realtimeTokenIssuer":true,"providerWithdrawalsRuntimeEnabled":true}}
```

The live activation boundary is now reconciled across the required controls. The provider setting was visually verified in the authenticated merchant console with **Disable withdrawal via API** switched off; the runtime gate is now true; and the independent read-only Neon main-branch query confirms the enabled database flags. No secret values, payout destinations, invoices, or payment amounts are recorded in this audit.

| Control | Required state | Verified state |
| --- | --- | --- |
| Provider API withdrawals | Enabled | **Enabled** — the provider’s disable switch is off |
| Backend runtime gate | `PLISIO_WITHDRAWALS_ENABLED === "true"` | **Enabled** — public `/health` capability is true |
| Crypto commerce | `crypto_commerce=true` | **Enabled** |
| Creator payout requests | `creator_payout_requests=true` | **Enabled** |
| Provider withdrawal execution | `provider_withdrawals=true` | **Enabled** |
| Customer wallet custody | `customer_wallet_custody=false` | **Intentionally disabled** |
| Scheduled payout requests | `scheduled_payout_requests=false` | **Intentionally disabled** |

With these controls active, an owner-approved creator payout may use the guarded inline executor in the current free-tier topology: it decrypts the server-encrypted destination only for provider submission, estimates the provider fee, makes an atomic database claim before the irreversible API call, and records the provider-confirmed settlement through the immutable ledger. The absence of Redis and an isolated worker does not block this owner-approved path; it operates synchronously as the documented free-tier fallback. Exact crypto units reported by the provider and ledger remain the settlement authority. USD values are reference-only.

> **Controlled reconciliation remains required before treating a first transfer as operationally proven.** The next production action is a deliberately small owner-reviewed payout through an encrypted creator destination, followed by verification that the request reaches `submitted` or `completed` with its provider payout identifier, provider transaction URL, and immutable ledger movement. No transfer was initiated during this activation work. The provider secret seen in the merchant-console session must still be rotated and replaced in Render’s masked `PLISIO_SECRET_KEY` field.

## Completed merchant-secret rotation

On **2026-08-12 EDT**, the merchant secret exposed during the authenticated Plisio console review was retired. A new high-entropy replacement was generated locally, entered into the KRYV merchant-site **Secret key** field, and saved in the provider console. The existing KRYV controls were preserved during this save: Client-borne provider commission, BTC/LTC/DOGE/ETH support, 30-minute expiry, zero-percent underpayment tolerance, White Label processing, QR invoice amount support, and provider API withdrawals enabled.

The replacement was then installed only in Render’s masked `PLISIO_SECRET_KEY` environment field. The temporary legacy `Plisio_Token` fallback entry was removed before saving, so the deployed backend no longer relies on the prior credential name. Render triggered deployment `dep-d9ujnvbm8hqs73ctobag` from revision `c45c83e`; its logs show the HTTP server listening and the service live.

The read-only production readiness gate then passed with `status: ok`, `mode: free-tier-fallback`, and `providerWithdrawalsRuntimeEnabled: true`. A non-mutating GET probe to the signed Plisio callback endpoint completed successfully. The protected local temporary secret file was deleted after the provider and runtime updates, and no secret value is recorded in this audit, source control, or operator log.

> The rotation is complete, but it does **not** substitute for the two remaining controlled reconciliations: one signed small crypto tip settled at the 95/5 split, followed by one small owner-approved payout that reaches `submitted` or `completed` with a provider identifier, transaction URL, and immutable movement. Customer wallet custody and scheduled payout requests remain disabled; advertising delivery remains dark.

## Post-rotation no-payment checkout-path verification

After the merchant-secret rotation, a deterministic no-network callback fixture, 95/5 allocation check, API build, frontend build, and read-only production readiness gate all passed. The fixture verifies that only a correctly signed Plisio callback for an approved BTC, LTC, ETH, or DOGE rail is accepted; it does not contact Plisio, create an invoice, or mutate production data. The production readiness response continues to report `mode: free-tier-fallback` and `providerWithdrawalsRuntimeEnabled: true`.

The deployed Kryv channel support surface was then reviewed in an authenticated browser without selecting **Continue**, a subscription tier, or any payment action. The public channel rendered its explicit offline fallback, compact creator identity, theater-mode control, and support action. Opening the support action displayed a Kryv-branded crypto-only overlay over the channel view while retaining the broadcast surface beneath it. The overlay visibly discloses that BTC, LTC, ETH, and DOGE are supported; customer wallet custody is unavailable; the creator receives 95% of the provider-confirmed eligible crypto subtotal; Kryv retains 5%; and the provider checkout commission is separately borne by the customer. It supports a USD reference quote only; the provider-confirmed crypto amount remains the settlement authority.

No invoice, provider checkout, signed settlement callback, payment, creator-balance credit, payout request, provider withdrawal, or on-chain transfer was created during this verification. The next unresolved proof remains a user-submitted smallest-available real crypto tip, followed by callback and immutable-ledger reconciliation before any owner-approved payout is attempted.

## Creator-profile release and production repair

The production channel model now supports optional public biography, website, YouTube, Instagram, and X destinations. Database migration `1259ac00-dc29-4c00-92b1-118f3b87c4e3` was first verified on an isolated Neon branch and promoted to production only after explicit approval. The dashboard exposes these inputs with HTTPS and official-domain guidance; no creator profile values were changed during deployment verification.

An initial production request after this release exposed a serializer contract fault: the additive database columns existed, but the runtime database table model did not select them, which caused the channel detail contract to reject `undefined` fields. The defect was fixed in revision `fdf1cc1` (`fix: expose creator links in runtime schema`), deployed successfully, and rechecked. `GET /api/channels/slug/fano` now returns HTTP 200 and includes `websiteUrl`, `youtubeUrl`, `instagramUrl`, and `xUrl` as safe `null` values when no profile links are configured. The deployed `/live/fano` page renders normally after the repair. A final read-only production readiness gate passed.

> This evidence demonstrates product and contract readiness without substituting for a real settlement. The actual 95/5 tip ledger movements and the first guarded payout are still intentionally unproven until a real crypto payment is available.

## Persistent live-channel workspace release

On **2026-08-13 EDT**, revision `3a195e0` (`feat: add persistent live channel workspace`) was committed and pushed to `DGC4/Kryv` main. Render built the backend successfully, started the HTTP server, and reported the service live. The deployed frontend was then verified at `/live/fano` against the production API.

| Verification area | Production result |
| --- | --- |
| Desktop discovery | The `xl` persistent left rail renders Live navigation, Browse Categories, followed-live empty state, live-room empty state, and an Explore Live escape route. |
| Channel action strip | The identity strip is directly below the player and exposes follow state, alert state, crypto support, subscription, share, channel report, creator identity, offline status, viewer count, category, language, and follower count without requiring a page-level detour. |
| Safety reporting | The Report control opens an accessible channel-level reason picker and optional-context dialog. The dialog was opened and closed only; no report was submitted. |
| About and integrity disclosure | The About area renders below the action strip and includes the creator profile/promotions fallback plus the clear crypto-integrity disclosure: provider-confirmed settlement, 95% creator balance, separate 5% Kryv share, client-borne provider commission, and USD as a reference quote only. |
| Theater mode | Theater mode enters and exits successfully. It hides the left discovery rail while retaining the player surface, compact action strip, About information, and chat area. |
| Readiness gate | `pnpm run verify:production-readiness` passed with `status: ok`, `mode: free-tier-fallback`, and `providerWithdrawalsRuntimeEnabled: true`. |

No crypto support flow, provider checkout, subscription checkout, payment, tip, signed callback, creator credit, channel report submission, payout request, or provider withdrawal was created during this release verification. The availability and money-readiness boundary is unchanged: the deployment remains on the documented free-tier fallback without production Redis, queue, isolated worker, or realtime gateway, and the first real 95/5 tip settlement plus first owner-approved payout reconciliation remain open evidence requirements.

## Controlled tip evidence review and checkout-state repair

On **2026-08-13 EDT**, the owner-reported production tip test was reconciled against the production Neon ledger rather than inferred from the browser checkout experience. The only recorded `tip` payment intent was `id=1`, created at `2026-08-13T04:44:57.341Z`, for a USD-reference amount of `5.00000000` with BTC selected. Its provider invoice metadata recorded a merchant invoice amount of `0.00007858 BTC`, a client-borne provider commission of `0.00000117 BTC`, and a required total of `0.00007975 BTC`. The intent’s authoritative status was **failed** and `completed_at` was null.

The database contained no associated `payment_events` record, no settled `tips` row, no creator balance movement, and no payout request. This correctly prevented an unbacked 95% creator credit or 5% platform movement, but it means the reported checkout did **not** satisfy the signed-tip reconciliation gate and cannot substantiate a first payout.

The failure was traced to a Kryv application contract mismatch after successful provider invoice creation. The checkout helper persisted the provider invoice as pending, then returned a response identifying its provider as `crypto`; the runtime response contract requires the provider identifier `plisio`. That validation failure was caught by the checkout helper and incorrectly rewrote the just-created intent to `failed`. Revision `dbc8710` (`fix: preserve successful crypto checkout state`) corrects the response identifier to `plisio`. The API build passed, Render deployed the revision successfully, and the read-only production readiness gate passed after deployment.

A parallel production flag audit found `ads_delivery=true` despite the standing requirement to keep ad delivery dark until one funded, consented, measured, and reconciled flight exists. The flag was restored to **false** on the production Neon main branch at `2026-08-13T07:11:22.814Z`. This prevents the live ad-decision and ad-break paths from serving unreconciled delivery while preserving the owner campaign and funding control plane.

> **Current required operational step:** after revision `dbc8710` is live, a smallest-available real BTC, LTC, ETH, or DOGE tip must be paid through the corrected Kryv checkout. Reconciliation requires a completed payment intent, a signed processed provider event, one settled tip row, explicit 95/5 creator/platform ledger entries, and exact provider-reported crypto amounts. Only after that evidence exists may a small owner-approved payout be requested. If any payout reaches `executing` with a risk-hold reason, stop immediately and never re-approve it.

## Support, membership, checkout-contract, and theme repair

Revision `ad9b5c5` (`fix: clarify crypto support and membership checkout`) was deployed successfully to the Kryv production service on **2026-08-13 EDT**. The release corrected the viewer-facing support flow and the response contract that feeds it.

The signed-in production channel surface now separates **one-time crypto support** from **channel membership**. One-time support presents BTC, LTC, ETH, and DOGE as compact lightweight asset marks; renders the USD reference amount with a visible `$` prefix; and uses the single, explicit action **Show {asset} payment instructions**. Membership presents three differentiated levels—Tier 1 / Supporter / $6.99, Tier 2 / Backer / $14.99, and Tier 3 / Patron / $24.99—with distinct selected states and a final action that names the exact selected tier and USD reference quote. These values match the currently configured subscription-tier production environment values.

The previously non-responsive-looking support flow had two independent causes: the provider identity mismatch fixed in `dbc8710`, and a runtime response schema that stripped the provider-confirmed QR code, payment address, crypto subtotal, commission, and total before the frontend received them. The shared `CryptoCheckoutResponse` contract now preserves those fields. As a result, a successful invoice response can render the intended player-preserving QR/address instruction surface instead of showing a generic unavailable state.

The support panel also now routes viewers to the existing **Kryv Wallet** surface rather than presenting a misleading actionable `Coming soon` wallet control. This preserves a consistent wallet destination while accurately retaining the deposit-address activation boundary: customer-wallet custody and internal wallet payments remain disabled until a signed pay-in callback and full reconciliation have been completed.

The global theme system was expanded from an accent-only change to full theme token sets covering the visible canvas, cards, popovers, controls, and accents. Selected theme state is persisted in browser storage. Production visual verification confirmed that cycling the theme changes the visible channel accent treatments and surrounding interface, and that Tier 2 selection changes its card treatment, $14.99 summary, and final checkout action. No invoice, tip, wallet deposit, subscription payment, or payout was submitted during this UI verification.

The API and frontend builds passed before deployment. The read-only production readiness gate passed after deployment with `providerWithdrawalsRuntimeEnabled: true` and `mode: free-tier-fallback`. This status does not validate the unresolved always-on, Redis, queue, worker, realtime, provider-request-IP, first settled tip, first pay-in, or first payout reconciliation gates.

## 95/5 settlement-path verification

On **2026-08-13 EDT**, the production Neon policy records were rechecked for the only eligible revenue types. The active version 1 `tip` policy and active version 1 `subscription` policy each specify `platform_fee_bps = 500`, which allocates a 5% Kryv platform fee and 95% creator net share from the provider-confirmed crypto subtotal. Provider checkout commission remains independently client-borne in the checkout and settlement metadata; it is not part of the 95/5 allocation base.

The signed callback handler was reviewed through its transactional settlement path. For a `completed` provider callback, it updates the payment intent exactly once, inserts the immutable completed tip or subscription record, writes the gross creator movement, writes the independent platform-revenue movement, writes the matching creator platform-fee debit, and increments the creator balance by the computed creator net amount. The callback transaction rolls back if an expected immutable movement cannot be written. All entries use provider-payment-ID-derived idempotency keys.

The fixed-point fee fixture passed for an eight-decimal crypto subtotal: gross `0.12345678`, platform fee `0.00617283`, and creator net `0.11728395`. The signed callback fixture also passed without provider network access or money movement. The live health surface remains `status: ok`, crypto withdrawals runtime-enabled, and in `free-tier-fallback` mode without shared cache or durable queue.

This is **code and configuration readiness evidence only**, not live settlement evidence. At the time of review, production contained five pending BTC tip intents and no completed tip intent, payment event, tip row, creator-balance movement, or platform-revenue movement. The failed original intent and all pending replacement invoices still require a real completed payment and signed provider callback before the 95/5 settlement can be marked proven.

## Persistent live-chat composer repair

On **2026-08-13 EDT**, the desktop live-channel chat rail was repaired and deployed in commit `7e6fb7f` (`fix: keep live chat composer in view`). The channel workspace no longer creates a vertical clipping context around the player area. On desktop, the chat rail is sticky beside the workspace and the message composer remains visible while the viewer scrolls through the action strip, About section, and engagement surfaces. On compact screens, chat is fixed above the page bottom and channel content receives matching bottom clearance so the composer remains reachable without scrolling through page content.

The frontend production build passed. Render deployed the revision successfully, and visual production verification at `/live/fano` confirmed that the visible `Send a message…` composer remains present on initial load and after scrolling to the bottom of the channel content. No chat was sent during this verification.

### Current Phase A gate state

Production flags were rechecked after the chat release: `crypto_commerce`, `creator_payout_requests`, and `provider_withdrawals` are enabled. `ads_delivery`, `customer_wallet_custody`, and `scheduled_payout_requests` remain disabled. The active 95/5 policy remains configured, but no retained signed provider callback, completed tip, payment event, creator-balance movement, or platform-revenue movement exists in production. An owner-reported payment that was subsequently deleted cannot serve as reconciliation evidence. A new completed payment whose provider record and signed callback remain retained is required before settlement or payout reconciliation is marked proven.

## Creator broadcast-setup workflow repair

On **2026-08-13 EDT**, revision `d3d5b1a` (`fix: focus creator broadcast setup`) was built and deployed successfully. The authenticated production Creator Dashboard was verified at `/dashboard/live`: selecting **Open broadcast setup** now keeps the creator in the Stream Manager and scrolls directly to the existing Stream Credentials panel containing the RTMPS server URL and masked stream key. The action shows the correct next-step guidance rather than leaving the creator on an unrelated dashboard section.

The deployed dashboard retained its existing safety surfaces during verification: masked stream credentials, explicit rotation control, offline preview state, local-only browser camera/microphone preflight, creator chat with delete/timeout/ban controls, engagement management tabs, and the OBS handoff guide. No stream key was rotated, stream settings changed, camera permission requested, chat message sent, payment initiated, or payout action performed.

> This release improves the creator workflow only. It does not change the free-tier topology, the REST fallback for production chat, crypto settlement evidence, customer wallet custody, scheduled payout requests, or advertising-delivery gating.


## Retained settlement gate recheck

A final read-only production Neon query on **2026-08-13 EDT** found `payment_events=0`, `tips=0`, `creator_balance_movements=0`, and `creator_balances=0`. The owner-reported completed payment cannot be reconciled because its retained settlement evidence was deleted. Accordingly, there is no signed-provider callback, immutable payment event, settled tip row, 95% creator movement, 5% platform movement, or creator balance record that can prove the 95/5 flow in production.

Creator Profile, Watch, and Cinema expansion remain gated by this missing retained evidence. This is an operating-evidence boundary rather than a known checkout, fee-policy, callback-code, or UI defect: the active 95/5 policy, deterministic allocation checks, signed callback path, crypto commerce runtime, and production invoice creation flow have already been reviewed. Customer wallet custody, scheduled payout requests, and advertising delivery remain disabled.

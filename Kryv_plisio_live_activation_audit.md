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

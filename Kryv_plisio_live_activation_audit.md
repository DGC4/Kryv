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

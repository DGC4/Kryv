# Crypto provider reference

Kryv’s crypto-only design is grounded in Plisio’s official documentation:

- [Create an invoice](https://plisio.net/documentation/endpoints/create-an-invoice) documents `callback_url`, unique merchant `order_number`, optional allowed cryptocurrencies, invoice URLs, and the `completed` callback status. It also documents JSON callback authentication as HMAC-SHA1 over the callback object without `verify_hash`, with `json=true` used for JSON callbacks.
- [Manage invoice updates and cash-in](https://plisio.net/documentation/endpoints/manage-invoice-updates-and-cash-in) documents the merchant status URL and POST invoice-update delivery.
- [Withdrawal / Mass withdrawal](https://plisio.net/documentation/endpoints/withdrawal-mass-withdrawal) documents the provider withdrawal endpoint, supported single or batch cash-out requests, wallet destination, amount, currency, provider secret, completion status, operation ID, transaction URL, and fee fields.

Implementation consequences: Kryv creates invoices with unique internal order numbers, only credits entitlements or creator balances from verified callbacks, keeps provider events idempotent, accepts only the configured approved coins, and requires owner-controlled payout review before a future provider withdrawal operation.

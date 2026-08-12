# Kryv Plisio Payout Worker — Verified Activation Gates

Kryv’s payout execution remains **disabled** until every activation gate is completed. The worker foundation may queue and validate owner-approved requests, but it must never call the provider while `provider_withdrawals` is false.

Plisio documents a single-withdrawal `GET /api/v1/operations/withdraw` endpoint requiring `currency`, `type=cash_out`, `to`, `amount`, and `api_key`. Its response provides a provider operation ID, status, provider fee, amount, and transaction URL. Plisio also documents a commission/fee-estimation endpoint. The provider’s documentation says a request IP must be configured for both withdrawal and fee-estimation operations.

## Required activation gates

1. The `CREATOR_PAYOUT_ENCRYPTION_KEY` is configured in the production environment and tested against AES-256-GCM payout profile encryption.
2. A provider withdrawal allowlist/request-IP configuration is verified in Plisio.
3. A single non-production or owner-controlled test payout completes from request to provider operation, reconciliation, immutable ledger entries, and reviewed status.
4. The fee-estimation result, provider response, idempotency key, masked destination, and transaction link are reconciled without storing a raw destination in logs or client responses.
5. An owner reviews the runbook and explicitly enables `provider_withdrawals` only after the previous checks pass.

## Sources

1. [Plisio Withdrawal / Mass Withdrawal](https://plisio.net/documentation/endpoints/withdrawal-mass-withdrawal)
2. [Plisio Fee Estimation](https://plisio.net/documentation/endpoints/plisio-fee)
3. [Plisio Transactions](https://plisio.net/documentation/endpoints/transactions)

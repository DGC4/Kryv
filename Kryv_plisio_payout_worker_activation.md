# Kryv Plisio Payout Worker — Production Activation Runbook

Kryv creator payouts are **crypto-only**. The supported payout currencies are BTC, LTC, ETH, and DOGE. USD is a display-only reference value and never controls payout settlement. The creator ledger remains authoritative in the provider-confirmed crypto amount.

## Activation boundary

A creator may request a payout only after a confirmed and owner-approved encrypted payout destination exists, the creator has completed the defined payout-ready achievements, and the available crypto balance is sufficient. Requesting a payout atomically moves the exact crypto amount from the creator’s available balance to its held balance. A creator destination is encrypted server-side with AES-256-GCM and only its masked form is returned to any client.

An owner must approve each individual request. Approval is accepted only while both the production database flag `provider_withdrawals` and the runtime switch `PLISIO_WITHDRAWALS_ENABLED` are enabled. Approval enqueues a `payout.request` job. If the durable queue is unavailable, the request is immediately restored to `held`; it cannot proceed silently.

> A payout is irreversible after the provider accepts it. Owner approval therefore authorizes a transfer of the exact approved crypto amount from Kryv’s provider treasury to the creator’s confirmed, owner-reviewed destination.

## Required controls before activation

| Control | Required state | Verification evidence |
|---|---|---|
| Destination security | `CREATOR_PAYOUT_ENCRYPTION_KEY` is a base64-encoded 32-byte production key | An encrypted profile decrypts only inside the worker, passes its SHA-256 integrity check, and never appears in a response, audit record, or worker log. |
| Provider access | Plisio request IP is configured and verified for the egress address used by the withdrawal worker | Provider fee-estimation and withdrawal documentation requires a request IP. Capture the provider confirmation before opening the feature flag. |
| Durable execution | `kryv-queue` and `kryv-worker` are deployed and healthy | Owner approval produces a durable job; queue failure returns the request to a `held` state. |
| Provider lock | Plisio’s `Disable withdrawal via API` is off and `PLISIO_WITHDRAWALS_ENABLED=true` is set only on the isolated worker runtime | The API service should not possess the withdrawal runtime enablement value. |
| Database control | `creator_payout_requests=true` and `provider_withdrawals=true`; `scheduled_payout_requests=false`; `customer_wallet_custody=false` | Read-only production flag audit recorded before and after activation. |
| Reconciliation | A controlled owner payout is completed and reconciled | Preserve payout request ID, worker job ID, provider operation ID, exact amount, provider fee quote and result, masked destination, transaction URL, ledger movement, and reviewer identity. |

## Worker execution lifecycle

| Request status | Meaning | Balance projection |
|---|---|---|
| `requested` | The creator has reserved an eligible amount; owner review is pending. | Available decreases; held increases by the exact crypto amount. |
| `held` | Owner or operations has paused execution. | Amount remains held. |
| `approved` | Owner approval was recorded and the job is pending execution. | Amount remains held. |
| `executing` | The worker atomically claimed the request before the irreversible provider call. | Amount remains held. |
| `submitted` | Plisio accepted the withdrawal but did not report a completed status. | Held decreases; a provider operation ID and transaction URL are recorded for manual completion reconciliation. |
| `completed` | Plisio reported the withdrawal completed. | Held decreases; a `payout_completed` immutable movement records the exact amount. |
| `rejected` | Owner rejected the request before provider execution. | Held amount is released back to available with an immutable `payout_released` movement. |

The worker obtains a provider fee estimate, atomically claims the approved request as `executing`, then submits one single-recipient `cash_out` operation to Plisio. The claim prevents a retry from submitting a second withdrawal after an ambiguous provider/network response. Any job that finds an existing provider operation or an `executing` request is preserved for manual reconciliation instead of being retried into another transfer.

## Reconciliation procedure

First, use the owner console to inspect the request and the linked immutable creator-balance movement. Confirm that the provider operation ID, provider status, returned exact amount, provider fee, fee estimate, transaction URL, and masked destination belong to the same request. Confirm that the provider amount exactly equals the owner-approved amount in fixed eight-decimal crypto arithmetic. Then confirm the transaction in the provider console and relevant chain explorer before considering the payout completed.

If the provider call times out or returns an ambiguous result after a request enters `executing`, do **not** retry it. Reconcile the request manually against Plisio by its provider operation and transaction records. Keep the request held for investigation if no provider operation is found; do not create a replacement request until the original operation is conclusively resolved.

## Incident response

Disable `provider_withdrawals` first if a provider mismatch, duplicate-risk condition, or queue integrity incident occurs. Then set `PLISIO_WITHDRAWALS_ENABLED=false` in the worker environment and restore Plisio’s API-withdrawal block. Preserve the job, payout request, approval, creator movement, audit log, and provider evidence for investigation. Do not enable customer wallet custody or scheduled payouts as a workaround.

## Sources

1. [Plisio Withdrawal / Mass Withdrawal](https://plisio.net/documentation/endpoints/withdrawal-mass-withdrawal)
2. [Plisio Fee Estimation](https://plisio.net/documentation/endpoints/plisio-fee)
3. [Plisio Transactions](https://plisio.net/documentation/endpoints/transactions)

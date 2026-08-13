# Kryv Durable Queue Operations

Kryv’s queue separates **request-path work** from asynchronous delivery. The HTTP API remains authoritative for moderation, commerce, balances, and entitlements; queue work is restricted to loss-tolerant analytics delivery and future owner-approved payout execution. FastPix remains the media data plane, and no video payload is queued or proxied through Kryv.

## Queue contract

| Item | Redis key | Retention behavior | Purpose |
|---|---|---|---|
| Ready jobs | `kryv:jobs` | Consumed FIFO by the worker | Jobs ready to process now |
| Scheduled retries | `kryv:jobs:scheduled` | Sorted by the next eligible timestamp | Exponential-backoff retry staging |
| Dead-letter jobs | `kryv:jobs:dead-letter` | Durable operator-review record | Malformed, exhausted, and explicitly blocked work |

Every job carries an immutable ID, type, occurrence time, payload, retry attempt, and maximum attempt count. The API normalizes the envelope before enqueueing, so old producers that omit retry metadata receive the safe default of four total processing attempts.

## Retry policy

Retryable external failures use deterministic exponential backoff: **1 second**, **2 seconds**, **4 seconds**, and then dead-letter after the fourth total processing attempt. Jobs are promoted from the scheduled set into the ready list by the worker before it blocks for the next item. The bounded policy prevents a failed integration from looping indefinitely or consuming the worker continuously.

Malformed job payloads do not enter business processing. They are written directly to the dead-letter list with a bounded diagnostic string. Dead-letter records must never include a raw payout destination, provider secret, or customer authentication token.

| Outcome | Worker behavior | Operator response |
|---|---|---|
| Analytics endpoint returns a transient error | Schedule bounded retry | Verify receiving endpoint, signature secret, and delivery logs; replay only after correction |
| Retry budget exhausted | Write `retry_exhausted` dead-letter record | Inspect the immutable job ID and downstream event idempotency before replay |
| Malformed serialized queue item | Write `malformed_durable_job` dead-letter record | Fix producer/version mismatch; do not blindly replay raw data |
| `payout.request` while payout gates are closed | Write `non_retryable_job` dead-letter record | Keep provider withdrawals disabled; investigate only under the payout activation runbook |
| Queue unavailable | Worker logs the failure and returns to its receive loop | Treat as an availability incident; do not claim delivery or settlement completion |

## Payout safety boundary

The worker deliberately treats every `payout.request` as **non-retryable and blocked** until the activation gates in `Kryv_plisio_payout_worker_activation.md` have been satisfied and the owner enables the required production controls. A dead-lettered payout job is not a payment instruction and must not trigger a provider withdrawal. The provider withdrawal lock and production feature flags remain the primary controls.

## Replay procedure

An authorized operator must first identify the root cause, verify that replay is idempotent at the receiving system, and record the reviewed dead-letter job ID. The operator then creates a new job with a new ID and a traceable reference to the original item. Directly moving a raw dead-letter payload back to the ready list is prohibited because it bypasses envelope validation and could duplicate an external side effect.

## Monitoring requirements

Alerting must cover queue unavailability, scheduled-retry depth, dead-letter depth, oldest ready-job age, and analytics delivery failure rate. Before deployment, confirm that the queue Redis service uses `noeviction` and persistent storage, while the cache Redis service remains separate and loss-tolerant. These metrics become mandatory before enabling payouts or customer wallet custody.

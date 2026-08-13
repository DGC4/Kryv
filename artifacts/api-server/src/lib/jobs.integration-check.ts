import assert from "node:assert/strict";
import {
  DEFAULT_MAX_JOB_ATTEMPTS,
  normalizeDurableJob,
  retryDelayMs,
} from "./jobs";

const normalized = normalizeDurableJob({
  id: "job-1",
  type: "analytics.event",
  occurredAt: "2026-08-12T00:00:00.000Z",
  payload: { event: "chat.message.created" },
});

assert.equal(normalized.attempt, 0);
assert.equal(normalized.maxAttempts, DEFAULT_MAX_JOB_ATTEMPTS);
assert.equal(retryDelayMs(1), 1_000);
assert.equal(retryDelayMs(2), 2_000);
assert.equal(retryDelayMs(3), 4_000);
assert.equal(retryDelayMs(10), 30_000);

const bounded = normalizeDurableJob({
  ...normalized,
  attempt: 2,
  maxAttempts: 6,
});
assert.equal(bounded.attempt, 2);
assert.equal(bounded.maxAttempts, 6);

assert.throws(
  () => normalizeDurableJob({ ...normalized, type: "unknown.event" }),
  /unsupported type/,
);
assert.throws(
  () => normalizeDurableJob({ ...normalized, payload: [] }),
  /missing payload/,
);

console.log("Kryv durable-job retry and dead-letter policy checks passed");

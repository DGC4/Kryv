import assert from "node:assert/strict";
import {
  signRealtimeToken,
  signToken,
  verifyRealtimeToken,
  verifyToken,
} from "./auth";

const payload = { userId: 42, username: "realtime-check", role: "creator" };
const realtimeToken = signRealtimeToken(payload);
const accessToken = signToken(payload);

assert.match(realtimeToken, /\./);
assert.deepEqual(
  (({ userId, username, role }) => ({ userId, username, role }))(verifyRealtimeToken(realtimeToken)!),
  payload,
);
assert.equal(verifyToken(realtimeToken), null);
assert.deepEqual(
  (({ userId, username, role }) => ({ userId, username, role }))(verifyRealtimeToken(accessToken)!),
  payload,
);
assert.deepEqual(
  (({ userId, username, role }) => ({ userId, username, role }))(verifyToken(accessToken)!),
  payload,
);

console.log("Kryv scoped realtime-token checks passed");

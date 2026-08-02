import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isMuxConfigured } from "./mux";

const originalTokenId = process.env.MUX_TOKEN_ID;
const originalTokenSecret = process.env.MUX_TOKEN_SECRET;

afterEach(() => {
  if (originalTokenId === undefined) delete process.env.MUX_TOKEN_ID;
  else process.env.MUX_TOKEN_ID = originalTokenId;

  if (originalTokenSecret === undefined) delete process.env.MUX_TOKEN_SECRET;
  else process.env.MUX_TOKEN_SECRET = originalTokenSecret;
});

describe("Mux readiness", () => {
  it("requires both server-only Mux API credentials before the live provider is considered ready", () => {
    delete process.env.MUX_TOKEN_ID;
    delete process.env.MUX_TOKEN_SECRET;
    assert.equal(isMuxConfigured(), false);

    process.env.MUX_TOKEN_ID = "token-id";
    assert.equal(isMuxConfigured(), false);

    process.env.MUX_TOKEN_SECRET = "token-secret";
    assert.equal(isMuxConfigured(), true);
  });
});

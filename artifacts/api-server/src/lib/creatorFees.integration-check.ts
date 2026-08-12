import assert from "node:assert/strict";
import { addCryptoAmounts, compareCryptoAmounts, normalizeCryptoAmount, quoteCreatorPlatformFee } from "./creatorFees";

const zeroFee = quoteCreatorPlatformFee("1.25", 0);
assert.deepEqual(zeroFee, {
  grossAmount: "1.25",
  platformFeeAmount: "0",
  creatorNetAmount: "1.25",
  platformFeeBps: 0,
});

const standardFee = quoteCreatorPlatformFee("0.12345678", 500);
assert.deepEqual(standardFee, {
  grossAmount: "0.12345678",
  platformFeeAmount: "0.00617283",
  creatorNetAmount: "0.11728395",
  platformFeeBps: 500,
});

assert.throws(() => quoteCreatorPlatformFee("0.01", 10_001));
assert.throws(() => quoteCreatorPlatformFee("0.000000001", 100));

assert.equal(normalizeCryptoAmount("01.25000000"), "1.25");
assert.equal(addCryptoAmounts("0.12345678", "0.00185185"), "0.12530863");
assert.equal(compareCryptoAmounts("0.12530863", "0.12530863"), 0);
assert.equal(compareCryptoAmounts("0.12530864", "0.12530863"), 1);
assert.equal(compareCryptoAmounts("0.12530862", "0.12530863"), -1);

console.log("creator fee allocator and provider-total checks passed");

import assert from "node:assert/strict";
import crypto from "node:crypto";

// Deliberately use an ephemeral fixture secret. This verification does not contact
// Plisio, create an invoice, submit a payout, or load a production credential.
process.env.PLISIO_SECRET_KEY = "fixture-only-plisio-callback-secret";
process.env.Plisio_Token = "";
process.env.PLISIO_CALLBACK_URL = "https://callback.example.test/api/webhooks/plisio?json=true";
process.env.KRYV_APP_URL = "https://app.example.test";
process.env.PLISIO_ALLOWED_COINS = "BTC,LTC,ETH,DOGE,XRP";

const { isPlisioConfigured, isSupportedKryvCryptoCode, supportedKryvCryptoCodes, verifyPlisioJsonCallback } = await import("./plisio");

const callback = {
  txn_id: "fixture-txn-95-5",
  order_number: "fixture-tip-order",
  status: "completed",
  ipn_type: "invoice",
  currency: "DOGE",
  amount: "10.15000000",
  invoice_sum: "10.00000000",
  invoice_commission: "0.15000000",
  invoice_total_sum: "10.15000000",
  confirmations: "6",
};
const verifyHash = crypto
  .createHmac("sha1", process.env.PLISIO_SECRET_KEY)
  .update(JSON.stringify(callback))
  .digest("hex");

assert.equal(isPlisioConfigured(), true);
assert.deepEqual(supportedKryvCryptoCodes(), ["BTC", "LTC", "ETH", "DOGE"]);
assert.equal(isSupportedKryvCryptoCode("DOGE"), true);
assert.equal(isSupportedKryvCryptoCode("XRP"), false);
assert.equal(verifyPlisioJsonCallback({ ...callback, verify_hash: verifyHash }), true);
assert.equal(verifyPlisioJsonCallback({ ...callback, amount: "10.14999999", verify_hash: verifyHash }), false);
assert.equal(verifyPlisioJsonCallback({ ...callback, verify_hash: "00".repeat(20) }), false);

console.log("Plisio signed callback and approved-coin fixture checks passed without network or money movement");

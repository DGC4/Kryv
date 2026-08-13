const CRYPTO_DECIMALS = 8;
const ATOMIC_SCALE = 10n ** BigInt(CRYPTO_DECIMALS);

/** Kryv's published creator economics: creators receive 95% and Kryv retains 5%. */
export const KRYV_PLATFORM_FEE_BPS = 500;
export const KRYV_CREATOR_SHARE_BPS = 10_000 - KRYV_PLATFORM_FEE_BPS;

export function creatorShareBps(platformFeeBps: number) {
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error("The active platform fee policy must be an integer between 0 and 10,000 basis points.");
  }
  return 10_000 - platformFeeBps;
}

export type CreatorFeeQuote = {
  grossAmount: string;
  platformFeeAmount: string;
  creatorNetAmount: string;
  platformFeeBps: number;
};

function parseCryptoAtomic(value: string) {
  if (!/^\d+(\.\d{1,8})?$/.test(value)) {
    throw new Error("Crypto settlement amounts must be non-negative decimals with at most eight places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const fractionAtomic = (fraction + "0".repeat(CRYPTO_DECIMALS)).slice(0, CRYPTO_DECIMALS);
  return BigInt(whole) * ATOMIC_SCALE + BigInt(fractionAtomic);
}

function formatCryptoAtomic(value: bigint) {
  const whole = value / ATOMIC_SCALE;
  const fraction = (value % ATOMIC_SCALE).toString().padStart(CRYPTO_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Quotes the platform fee in fixed crypto atomic units. JavaScript floating point
 * is never used for balances or fee allocation, which keeps the two immutable
 * ledger rows reconcilable to the provider-confirmed gross amount.
 */
export function normalizeCryptoAmount(value: string) {
  return formatCryptoAtomic(parseCryptoAtomic(value));
}

export function addCryptoAmounts(left: string, right: string) {
  return formatCryptoAtomic(parseCryptoAtomic(left) + parseCryptoAtomic(right));
}

export function compareCryptoAmounts(left: string, right: string) {
  const leftAtomic = parseCryptoAtomic(left);
  const rightAtomic = parseCryptoAtomic(right);
  return leftAtomic === rightAtomic ? 0 : leftAtomic > rightAtomic ? 1 : -1;
}

export function quoteCreatorPlatformFee(grossAmount: string, platformFeeBps: number): CreatorFeeQuote {
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error("The active platform fee policy must be an integer between 0 and 10,000 basis points.");
  }

  const grossAtomic = parseCryptoAtomic(grossAmount);
  const feeAtomic = (grossAtomic * BigInt(platformFeeBps)) / 10_000n;
  const netAtomic = grossAtomic - feeAtomic;

  return {
    grossAmount: formatCryptoAtomic(grossAtomic),
    platformFeeAmount: formatCryptoAtomic(feeAtomic),
    creatorNetAmount: formatCryptoAtomic(netAtomic),
    platformFeeBps,
  };
}

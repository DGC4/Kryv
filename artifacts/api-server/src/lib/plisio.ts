import crypto from "node:crypto";

const PLISIO_API_BASE = process.env.PLISIO_API_BASE ?? "https://api.plisio.net/api/v1";
const DEFAULT_ALLOWED_COINS = ["BTC", "LTC", "ETH", "DOGE"] as const;

export type KryvCryptoCode = (typeof DEFAULT_ALLOWED_COINS)[number];

export class PlisioNotConfiguredError extends Error {
  constructor(message = "Crypto checkout is not configured. Set PLISIO_SECRET_KEY, KRYV_APP_URL, and PLISIO_CALLBACK_URL in the deployment environment.") {
    super(message);
    this.name = "PlisioNotConfiguredError";
  }
}

export type PlisioInvoice = {
  transactionId: string;
  invoiceUrl: string;
  selectedCurrency: string | null;
  expiresAt: Date | null;
};

export type PlisioAssetSnapshot = {
  currency: KryvCryptoCode;
  priceUsd: string;
  treasuryBalance: string | null;
  fetchedAt: Date;
};

export type PlisioWithdrawal = {
  providerPayoutId: string;
  status: string;
  amount: string;
  feeAmount: string | null;
  transactionUrl: string | null;
};

let assetSnapshotCache: { expiresAt: number; values: PlisioAssetSnapshot[] } | null = null;

function getSecretKey() {
  const key = process.env.PLISIO_SECRET_KEY?.trim();
  if (!key) throw new PlisioNotConfiguredError();
  return key;
}

function getCallbackUrl() {
  const value = process.env.PLISIO_CALLBACK_URL?.trim();
  if (!value) throw new PlisioNotConfiguredError("PLISIO_CALLBACK_URL must be configured before crypto checkout is enabled.");
  const callbackUrl = new URL(value);
  if (process.env.NODE_ENV === "production" && callbackUrl.protocol !== "https:") {
    throw new PlisioNotConfiguredError("PLISIO_CALLBACK_URL must use HTTPS in production.");
  }
  callbackUrl.searchParams.set("json", "true");
  return callbackUrl.toString();
}

function getAppUrl() {
  const value = process.env.KRYV_APP_URL?.trim();
  if (!value) throw new PlisioNotConfiguredError("KRYV_APP_URL must be configured before crypto checkout is enabled.");
  const appUrl = new URL(value);
  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
    throw new PlisioNotConfiguredError("KRYV_APP_URL must use HTTPS in production.");
  }
  return appUrl.origin;
}

function allowedCoins() {
  const configured = process.env.PLISIO_ALLOWED_COINS
    ?.split(",")
    .map((coin) => coin.trim().toUpperCase())
    .filter(Boolean);
  const candidates = configured?.length ? configured : [...DEFAULT_ALLOWED_COINS];
  return candidates.filter((coin): coin is KryvCryptoCode => DEFAULT_ALLOWED_COINS.includes(coin as KryvCryptoCode));
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isPlisioConfigured() {
  return Boolean(process.env.PLISIO_SECRET_KEY?.trim() && process.env.PLISIO_CALLBACK_URL?.trim() && process.env.KRYV_APP_URL?.trim());
}

export function supportedKryvCryptoCodes() {
  return allowedCoins();
}

export function isSupportedKryvCryptoCode(value: unknown): value is KryvCryptoCode {
  return typeof value === "string" && (allowedCoins() as readonly string[]).includes(value.toUpperCase());
}

export async function getPlisioAssetSnapshots(): Promise<PlisioAssetSnapshot[]> {
  if (!isPlisioConfigured()) return [];
  if (assetSnapshotCache && assetSnapshotCache.expiresAt > Date.now()) return assetSnapshotCache.values;

  const secretKey = getSecretKey();
  const base = PLISIO_API_BASE.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const currenciesResponse = await fetch(`${base}/currencies/USD?${new URLSearchParams({ api_key: secretKey }).toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const currenciesPayload = await currenciesResponse.json().catch(() => null) as any;
    if (!currenciesResponse.ok || currenciesPayload?.status !== "success" || !Array.isArray(currenciesPayload?.data)) {
      throw new Error("Plisio currency metadata could not be loaded.");
    }
    const byCurrency = new Map<string, any>(currenciesPayload.data.map((value: any) => [String(value?.currency ?? "").toUpperCase(), value]));
    const balances = await Promise.all((allowedCoins()).map(async (currency) => {
      try {
        const response = await fetch(`${base}/balances/${encodeURIComponent(currency)}?${new URLSearchParams({ api_key: secretKey }).toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as any;
        return response.ok && payload?.status === "success" && typeof payload?.data?.balance === "string" ? payload.data.balance : null;
      } catch {
        return null;
      }
    }));
    const fetchedAt = new Date();
    const values = allowedCoins().flatMap((currency, index) => {
      const asset = byCurrency.get(currency);
      if (!asset || typeof asset.price_usd !== "string") return [];
      return [{ currency, priceUsd: asset.price_usd, treasuryBalance: balances[index], fetchedAt }];
    });
    assetSnapshotCache = { expiresAt: Date.now() + 60_000, values };
    return values;
  } finally {
    clearTimeout(timer);
  }
}

export async function createPlisioWithdrawal(input: {
  currency: KryvCryptoCode;
  destination: string;
  amount: string;
  feePlan?: "normal" | "priority";
}): Promise<PlisioWithdrawal> {
  if (process.env.PLISIO_WITHDRAWALS_ENABLED !== "true") {
    throw new Error("Provider withdrawals are disabled. Complete the documented owner activation gates before enabling them.");
  }
  if (!isSupportedKryvCryptoCode(input.currency)) {
    throw new Error("The requested payout currency is not enabled for Kryv.");
  }
  if (!/^\d+(\.\d{1,8})?$/.test(input.amount) || input.amount === "0") {
    throw new Error("A payout amount must be a positive crypto decimal with at most eight places.");
  }
  const destination = input.destination.trim();
  if (destination.length < 10 || destination.length > 256 || /[\s,]/.test(destination)) {
    throw new Error("The payout destination has an invalid format.");
  }

  const params = new URLSearchParams({
    currency: input.currency,
    type: "cash_out",
    to: destination,
    amount: input.amount,
    feePlan: input.feePlan ?? "normal",
    api_key: getSecretKey(),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${PLISIO_API_BASE.replace(/\/$/, "")}/operations/withdraw?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok || payload?.status !== "success" || !payload?.data?.id) {
      const message = typeof payload?.data?.message === "string" ? payload.data.message : "Plisio could not create the crypto withdrawal.";
      throw new Error(message);
    }
    return {
      providerPayoutId: String(payload.data.id),
      status: typeof payload.data.status === "string" ? payload.data.status : "submitted",
      amount: typeof payload.data.amount === "string" ? payload.data.amount : input.amount,
      feeAmount: typeof payload.data.fee === "string" ? payload.data.fee : null,
      transactionUrl: typeof payload.data.tx_url === "string" ? payload.data.tx_url : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function createPlisioInvoice(input: {
  orderNumber: string;
  orderName: string;
  sourceAmountUsd: string;
  currency?: KryvCryptoCode;
  description?: string;
  successPath: string;
  failurePath: string;
}): Promise<PlisioInvoice> {
  const secretKey = getSecretKey();
  const selectedCurrency = input.currency;
  const allowed = allowedCoins();
  if (!allowed.length) throw new PlisioNotConfiguredError("PLISIO_ALLOWED_COINS does not include an approved Kryv payment currency.");
  if (selectedCurrency && !allowed.includes(selectedCurrency)) throw new PlisioNotConfiguredError("The requested cryptocurrency is not enabled for Kryv checkout.");

  const appUrl = getAppUrl();
  const params = new URLSearchParams({
    source_currency: "USD",
    source_amount: input.sourceAmountUsd,
    order_number: input.orderNumber,
    order_name: input.orderName.slice(0, 200),
    allowed_psys_cids: allowed.join(","),
    callback_url: getCallbackUrl(),
    success_invoice_url: `${appUrl}${input.successPath}`,
    fail_invoice_url: `${appUrl}${input.failurePath}`,
    api_key: secretKey,
  });
  if (selectedCurrency) params.set("currency", selectedCurrency);
  if (input.description) params.set("description", input.description.slice(0, 500));
  params.set("expire_min", "30");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${PLISIO_API_BASE.replace(/\/$/, "")}/invoices/new?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok || payload?.status !== "success" || !payload?.data?.txn_id || !payload?.data?.invoice_url) {
      const message = typeof payload?.data?.message === "string" ? payload.data.message : "Plisio could not create a crypto invoice.";
      throw new Error(message);
    }

    const expiresAt = payload.data.expire_utc ? new Date(Number(payload.data.expire_utc) * 1000) : null;
    return {
      transactionId: String(payload.data.txn_id),
      invoiceUrl: String(payload.data.invoice_url),
      selectedCurrency: typeof payload.data.currency === "string" ? payload.data.currency : selectedCurrency ?? null,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plisio documents JSON callbacks as an HMAC-SHA1 over JSON.stringify(callback
 * fields in provider order with verify_hash removed. The raw JSON parser on this
 * route preserves that property insertion order after JSON.parse.
 */
export function verifyPlisioJsonCallback(payload: Record<string, unknown>) {
  if (!payload || typeof payload.verify_hash !== "string") return false;
  let secretKey: string;
  try {
    secretKey = getSecretKey();
  } catch {
    return false;
  }

  const orderedPayload = { ...payload };
  const receivedHash = orderedPayload.verify_hash;
  delete orderedPayload.verify_hash;
  const expectedHash = crypto.createHmac("sha1", secretKey).update(JSON.stringify(orderedPayload)).digest("hex");
  return constantTimeEqual(expectedHash, receivedHash);
}

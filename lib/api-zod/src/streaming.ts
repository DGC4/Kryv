import { z } from "zod";

const CryptoCurrency = z.enum(["BTC", "LTC", "ETH", "DOGE"]);

export const SubscribeBody = z.object({
  tier: z.number().int().min(1).max(3).default(1),
  cryptoCurrency: CryptoCurrency.optional(),
});

export const CryptoCheckoutResponse = z.object({
  paymentIntentId: z.number(),
  invoiceUrl: z.string().url(),
  provider: z.literal("plisio"),
  status: z.literal("pending"),
  selectedCurrency: CryptoCurrency.nullable(),
  expiresAt: z.date().nullable(),
});

// Legacy route exports retain their established names, but now represent an
// invoice that must be confirmed by a verified provider callback before any
// subscription entitlement or creator tip is settled.
export const SubscribeResponse = CryptoCheckoutResponse;

export const TipBody = z.object({
  amount: z.number().positive().max(100000),
  currency: z.literal("USD").default("USD"),
  cryptoCurrency: CryptoCurrency.optional(),
  message: z.string().max(500).optional(),
});

export const TipResponse = CryptoCheckoutResponse;

export const EmoteResponse = z.object({
  id: z.number(),
  channelId: z.number().nullable(),
  code: z.string(),
  imageUrl: z.string(),
  isGlobal: z.boolean(),
  createdAt: z.date(),
});

export const ListEmotesResponse = z.array(EmoteResponse);

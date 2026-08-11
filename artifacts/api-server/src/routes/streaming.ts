import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  channelsTable,
  db,
  emotesTable,
  paymentIntentsTable,
} from "@workspace/db";
import {
  ListEmotesResponse,
  SubscribeBody,
  SubscribeResponse,
  TipBody,
  TipResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/tracking";
import {
  createPlisioInvoice,
  isPlisioConfigured,
  type KryvCryptoCode,
  PlisioNotConfiguredError,
} from "../lib/plisio";

const router: IRouter = Router();

function configuredSubscriptionAmount(tier: number) {
  const value = process.env[`KRYV_CRYPTO_SUB_TIER_${tier}_USD`]?.trim();
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
    throw new PlisioNotConfiguredError(`KRYV_CRYPTO_SUB_TIER_${tier}_USD must be configured to start crypto subscriptions.`);
  }
  return value;
}

async function assertChannelExists(channelId: number) {
  const [channel] = await db.select({ id: channelsTable.id, displayName: channelsTable.displayName }).from(channelsTable).where(eq(channelsTable.id, channelId));
  return channel ?? null;
}

async function createCryptoCheckout(input: {
  userId: number;
  channelId: number;
  channelName: string;
  paymentKind: "subscription" | "tip";
  sourceAmountUsd: string;
  cryptoCurrency?: KryvCryptoCode;
  metadata: Record<string, unknown>;
}) {
  if (!isPlisioConfigured()) throw new PlisioNotConfiguredError();

  const orderNumber = `kryv_${input.paymentKind}_${input.userId}_${crypto.randomUUID()}`;
  const [intent] = await db
    .insert(paymentIntentsTable)
    .values({
      orderNumber,
      purchaserUserId: input.userId,
      receiverChannelId: input.channelId,
      paymentKind: input.paymentKind,
      provider: "plisio",
      sourceAmount: input.sourceAmountUsd,
      sourceCurrency: "USD",
      selectedCurrency: input.cryptoCurrency ?? null,
      status: "creating",
      metadata: input.metadata,
    })
    .returning();

  if (!intent) throw new Error("Unable to initialize crypto checkout.");

  try {
    const invoice = await createPlisioInvoice({
      orderNumber,
      orderName: `Kryv ${input.paymentKind} · ${input.channelName}`,
      sourceAmountUsd: input.sourceAmountUsd,
      currency: input.cryptoCurrency,
      description: input.paymentKind === "subscription" ? `Kryv channel subscription for ${input.channelName}` : `Kryv creator tip for ${input.channelName}`,
      successPath: `/live/${input.channelId}?payment=confirmed`,
      failurePath: `/live/${input.channelId}?payment=cancelled`,
    });

    await db
      .update(paymentIntentsTable)
      .set({
        providerPaymentId: invoice.transactionId,
        selectedCurrency: invoice.selectedCurrency,
        status: "pending",
        expiresAt: invoice.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(paymentIntentsTable.id, intent.id));

    return SubscribeResponse.parse({
      paymentIntentId: intent.id,
      invoiceUrl: invoice.invoiceUrl,
      provider: "plisio",
      status: "pending",
      selectedCurrency: invoice.selectedCurrency,
      expiresAt: invoice.expiresAt,
    });
  } catch (error) {
    await db
      .update(paymentIntentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentIntentsTable.id, intent.id));
    throw error;
  }
}

// GET /emotes - List global emotes
router.get("/emotes", async (_req, res) => {
  const emotes = await db.select().from(emotesTable).where(eq(emotesTable.isGlobal, true));
  res.json(ListEmotesResponse.parse(emotes));
});

// GET /channels/:id/emotes - List channel emotes
router.get("/channels/:id/emotes", async (req, res) => {
  const channelId = Number(req.params.id);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  const emotes = await db.select().from(emotesTable).where(eq(emotesTable.channelId, channelId));
  res.json(ListEmotesResponse.parse(emotes));
});

// POST /channels/:id/subscribe - starts, but never grants, a crypto checkout.
router.post("/channels/:id/subscribe", requireAuth, async (req, res) => {
  const channelId = Number(req.params.id);
  const parsed = SubscribeBody.safeParse(req.body);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const channel = await assertChannelExists(channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  try {
    const amount = configuredSubscriptionAmount(parsed.data.tier);
    const checkout = await createCryptoCheckout({
      userId: req.user!.userId,
      channelId,
      channelName: channel.displayName,
      paymentKind: "subscription",
      sourceAmountUsd: amount,
      cryptoCurrency: parsed.data.cryptoCurrency,
      metadata: { tier: parsed.data.tier },
    });
    logActivity(req, "subscription_checkout_started", { channelId, tier: parsed.data.tier, paymentIntentId: checkout.paymentIntentId }).catch(console.error);
    res.status(201).json(SubscribeResponse.parse(checkout));
  } catch (error) {
    if (error instanceof PlisioNotConfiguredError) return res.status(503).json({ error: error.message });
    console.error("Crypto subscription checkout creation failed", error);
    res.status(502).json({ error: "Crypto checkout could not be started. Please try again." });
  }
});

// POST /channels/:id/tip - starts, but never settles, a crypto creator tip.
router.post("/channels/:id/tip", requireAuth, async (req, res) => {
  const channelId = Number(req.params.id);
  const parsed = TipBody.safeParse(req.body);
  if (!Number.isSafeInteger(channelId) || channelId < 1) return res.status(400).json({ error: "Invalid channel ID" });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const channel = await assertChannelExists(channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  try {
    const checkout = await createCryptoCheckout({
      userId: req.user!.userId,
      channelId,
      channelName: channel.displayName,
      paymentKind: "tip",
      sourceAmountUsd: parsed.data.amount.toFixed(2),
      cryptoCurrency: parsed.data.cryptoCurrency,
      metadata: { message: parsed.data.message?.trim() || null },
    });
    logActivity(req, "tip_checkout_started", { channelId, amount: parsed.data.amount, paymentIntentId: checkout.paymentIntentId }).catch(console.error);
    res.status(201).json(TipResponse.parse(checkout));
  } catch (error) {
    if (error instanceof PlisioNotConfiguredError) return res.status(503).json({ error: error.message });
    console.error("Crypto tip checkout creation failed", error);
    res.status(502).json({ error: "Crypto checkout could not be started. Please try again." });
  }
});

export default router;

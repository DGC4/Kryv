import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { 
  db, 
  subscriptionsTable, 
  emotesTable, 
  tipsTable,
  channelsTable
} from "@workspace/db";
import { 
  SubscribeBody, 
  SubscribeResponse,
  TipBody,
  TipResponse,
  ListEmotesResponse
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/tracking";

const router: IRouter = Router();

// GET /emotes - List global emotes
router.get("/emotes", async (_req, res) => {
  const emotes = await db
    .select()
    .from(emotesTable)
    .where(eq(emotesTable.isGlobal, true));
  
  res.json(ListEmotesResponse.parse(emotes));
});

// GET /channels/:id/emotes - List channel emotes
router.get("/channels/:id/emotes", async (req, res) => {
  const channelId = parseInt(req.params.id);
  if (isNaN(channelId)) return res.status(400).json({ error: "Invalid channel ID" });

  const emotes = await db
    .select()
    .from(emotesTable)
    .where(eq(emotesTable.channelId, channelId));
  
  res.json(ListEmotesResponse.parse(emotes));
});

// POST /channels/:id/subscribe - Subscribe to a channel
router.post("/channels/:id/subscribe", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const channelId = parseInt(req.params.id);
  if (isNaN(channelId)) return res.status(400).json({ error: "Invalid channel ID" });

  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  // Check if already subscribed
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        eq(subscriptionsTable.channelId, channelId),
        eq(subscriptionsTable.status, "active")
      )
    );

  if (existing) {
    return res.status(409).json({ error: "Already subscribed to this channel" });
  }

  // In a real app, you'd process payment here. 
  // For now, we just create the subscription.
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      channelId,
      tier: parsed.data.tier,
      status: "active",
      expiresAt,
    })
    .returning();

  logActivity(req, "subscribe", { channelId, tier: parsed.data.tier }).catch(console.error);

  res.status(201).json(SubscribeResponse.parse(sub));
});

// POST /channels/:id/tip - Send a tip to a channel
router.post("/channels/:id/tip", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const channelId = parseInt(req.params.id);
  if (isNaN(channelId)) return res.status(400).json({ error: "Invalid channel ID" });

  const parsed = TipBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [tip] = await db
    .insert(tipsTable)
    .values({
      senderUserId: userId,
      receiverChannelId: channelId,
      amount: parsed.data.amount.toString(),
      currency: parsed.data.currency,
      message: parsed.data.message || null,
    })
    .returning();

  logActivity(req, "tip", { channelId, amount: parsed.data.amount }).catch(console.error);

  res.status(201).json(TipResponse.parse(tip));
});

export default router;

import { Router, type IRouter } from "express";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  channelPointRewardsTable,
  channelPointsTable,
  channelPointRedemptionsTable,
  channelsTable,
  db,
  hostsTable,
  pollChoicesTable,
  pollsTable,
  pollVotesTable,
  predictionEntriesTable,
  predictionOutcomesTable,
  predictionsTable,
  raidsTable,
} from "@workspace/db";
import { attachUserId, requireAuth } from "../lib/auth";
import { logActivity } from "../lib/tracking";

const router: IRouter = Router();
const POINTS_COOLDOWN_SECONDS = 300;
const POINTS_PER_CLAIM = 10;

const channelParams = z.object({ id: z.coerce.number().int().positive() });
const actionBody = z.object({
  action: z.enum([
    "claim_points",
    "create_reward",
    "redeem_reward",
    "create_poll",
    "vote_poll",
    "end_poll",
    "create_prediction",
    "enter_prediction",
    "lock_prediction",
    "resolve_prediction",
    "raid",
    "set_host",
    "clear_host",
  ]),
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(500).optional(),
  choices: z.array(z.string().trim().min(1).max(80)).min(2).max(5).optional(),
  pollId: z.number().int().positive().optional(),
  choiceId: z.number().int().positive().optional(),
  predictionId: z.number().int().positive().optional(),
  outcomeId: z.number().int().positive().optional(),
  rewardId: z.number().int().positive().optional(),
  targetChannelId: z.number().int().positive().optional(),
  channelPoints: z.number().int().min(1).max(100_000).optional(),
  durationSeconds: z.number().int().min(30).max(3600).optional(),
  autoHost: z.boolean().optional(),
  userInput: z.string().trim().max(300).optional(),
});

async function getOwnedChannel(channelId: number, userId: number) {
  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, channelId));
  if (!channel) return { channel: null, error: "Channel not found" };
  if (channel.ownerUserId !== userId) return { channel, error: "Only the channel owner can perform this action." };
  return { channel, error: null };
}

async function getPointsBalance(channelId: number, userId: number) {
  const [points] = await db
    .select()
    .from(channelPointsTable)
    .where(and(eq(channelPointsTable.channelId, channelId), eq(channelPointsTable.userId, userId)));
  return points ?? null;
}

router.get("/channels/:id/engagement", attachUserId, async (req, res): Promise<void> => {
  const params = channelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, params.data.id));
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  let [activePoll] = await db
    .select()
    .from(pollsTable)
    .where(and(eq(pollsTable.channelId, channel.id), eq(pollsTable.status, "active")))
    .orderBy(desc(pollsTable.startedAt))
    .limit(1);
  if (activePoll && activePoll.startedAt.getTime() + activePoll.durationSeconds * 1000 <= Date.now()) {
    await db.update(pollsTable).set({ status: "ended", endedAt: new Date() }).where(eq(pollsTable.id, activePoll.id));
    activePoll = undefined;
  }
  const pollChoices = activePoll
    ? await db.select().from(pollChoicesTable).where(eq(pollChoicesTable.pollId, activePoll.id))
    : [];

  let [activePrediction] = await db
    .select()
    .from(predictionsTable)
    .where(and(eq(predictionsTable.channelId, channel.id), or(eq(predictionsTable.status, "active"), eq(predictionsTable.status, "locked"))))
    .orderBy(desc(predictionsTable.startedAt))
    .limit(1);
  if (activePrediction?.status === "active" && activePrediction.startedAt.getTime() + activePrediction.predictionWindowSeconds * 1000 <= Date.now()) {
    const [locked] = await db.update(predictionsTable).set({ status: "locked", lockedAt: new Date() }).where(eq(predictionsTable.id, activePrediction.id)).returning();
    activePrediction = locked;
  }
  const predictionOutcomes = activePrediction
    ? await db.select().from(predictionOutcomesTable).where(eq(predictionOutcomesTable.predictionId, activePrediction.id))
    : [];

  const points = req.user ? await getPointsBalance(channel.id, req.user.userId) : null;
  res.json({
    pointsBalance: points?.balance ?? null,
    pointsEnabled: channel.channelPointsEnabled,
    activePoll: activePoll ? { ...activePoll, choices: pollChoices } : null,
    activePrediction: activePrediction ? { ...activePrediction, outcomes: predictionOutcomes } : null,
  });
});

router.post("/channels/:id/engagement/actions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const params = channelParams.safeParse(req.params);
  const body = actionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
    return;
  }

  const channelId = params.data.id;
  const data = body.data;

  if (data.action === "claim_points") {
    const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, channelId));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    if (!channel.isLive || !channel.channelPointsEnabled) {
      res.status(400).json({ error: "Channel points are only available while this live channel has points enabled." });
      return;
    }

    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - POINTS_COOLDOWN_SECONDS * 1000);

    try {
      const points = await db.transaction(async (tx) => {
        // The guarded update makes the cooldown atomic even when several browser tabs
        // submit a claim at exactly the same time.
        const [updated] = await tx
          .update(channelPointsTable)
          .set({
            balance: sql`${channelPointsTable.balance} + ${POINTS_PER_CLAIM}`,
            totalEarned: sql`${channelPointsTable.totalEarned} + ${POINTS_PER_CLAIM}`,
            lastEarnedAt: now,
          })
          .where(
            and(
              eq(channelPointsTable.channelId, channelId),
              eq(channelPointsTable.userId, userId),
              or(isNull(channelPointsTable.lastEarnedAt), lte(channelPointsTable.lastEarnedAt, cooldownCutoff)),
            ),
          )
          .returning();
        if (updated) return updated;

        const [existing] = await tx
          .select()
          .from(channelPointsTable)
          .where(and(eq(channelPointsTable.channelId, channelId), eq(channelPointsTable.userId, userId)));
        if (existing) {
          const remaining = Math.max(1, Math.ceil((existing.lastEarnedAt!.getTime() + POINTS_COOLDOWN_SECONDS * 1000 - now.getTime()) / 1000));
          throw new Error(`Points are on cooldown for ${remaining} more seconds.`);
        }

        const [created] = await tx
          .insert(channelPointsTable)
          .values({ channelId, userId, balance: POINTS_PER_CLAIM, totalEarned: POINTS_PER_CLAIM, lastEarnedAt: now })
          .returning();
        return created;
      });
      res.json({ action: data.action, pointsBalance: points.balance, awarded: POINTS_PER_CLAIM });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim points";
      res.status(message.startsWith("Points are on cooldown") ? 429 : 409).json({ error: message });
    }
    return;
  }

  const owned = await getOwnedChannel(channelId, userId);
  if (!owned.channel) {
    res.status(404).json({ error: owned.error });
    return;
  }

  const ownerActions = new Set(["create_reward", "create_poll", "end_poll", "create_prediction", "lock_prediction", "resolve_prediction", "raid", "set_host", "clear_host"]);
  if (ownerActions.has(data.action) && owned.error) {
    res.status(403).json({ error: owned.error });
    return;
  }

  if (data.action === "create_reward") {
    if (!data.title || !data.channelPoints) {
      res.status(400).json({ error: "A reward title and point cost are required." });
      return;
    }
    const [reward] = await db.insert(channelPointRewardsTable).values({ channelId, title: data.title, description: data.description ?? null, cost: data.channelPoints }).returning();
    res.status(201).json({ action: data.action, entityId: reward.id });
    return;
  }

  if (data.action === "redeem_reward") {
    if (!data.rewardId) {
      res.status(400).json({ error: "A reward is required." });
      return;
    }
    try {
      const redemption = await db.transaction(async (tx) => {
        const [reward] = await tx.select().from(channelPointRewardsTable).where(and(eq(channelPointRewardsTable.id, data.rewardId!), eq(channelPointRewardsTable.channelId, channelId), eq(channelPointRewardsTable.isEnabled, true), eq(channelPointRewardsTable.isPaused, false)));
        if (!reward) throw new Error("Reward unavailable");
        const [points] = await tx.select().from(channelPointsTable).where(and(eq(channelPointsTable.channelId, channelId), eq(channelPointsTable.userId, userId)));
        if (!points || points.balance < reward.cost) throw new Error("Insufficient channel points");
        await tx.update(channelPointsTable).set({ balance: points.balance - reward.cost }).where(eq(channelPointsTable.id, points.id));
        const [created] = await tx.insert(channelPointRedemptionsTable).values({ rewardId: reward.id, channelId, userId, userInput: data.userInput ?? null, status: reward.autoFulfill ? "fulfilled" : "unfulfilled" }).returning();
        return created;
      });
      res.status(201).json({ action: data.action, entityId: redemption.id });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to redeem this reward" });
    }
    return;
  }

  if (data.action === "create_poll") {
    if (!data.title || !data.choices) {
      res.status(400).json({ error: "A poll title and at least two choices are required." });
      return;
    }
    const poll = await db.transaction(async (tx) => {
      await tx.update(pollsTable).set({ status: "ended", endedAt: new Date() }).where(and(eq(pollsTable.channelId, channelId), eq(pollsTable.status, "active")));
      const [created] = await tx.insert(pollsTable).values({ channelId, title: data.title!, durationSeconds: data.durationSeconds ?? 120 }).returning();
      await tx.insert(pollChoicesTable).values(data.choices!.map((title) => ({ pollId: created.id, title })));
      return created;
    });
    res.status(201).json({ action: data.action, entityId: poll.id });
    return;
  }

  if (data.action === "vote_poll") {
    if (!data.pollId || !data.choiceId) {
      res.status(400).json({ error: "A poll and choice are required." });
      return;
    }
    try {
      await db.transaction(async (tx) => {
        const [poll] = await tx.select().from(pollsTable).where(and(eq(pollsTable.id, data.pollId!), eq(pollsTable.channelId, channelId), eq(pollsTable.status, "active")));
        const [choice] = await tx.select().from(pollChoicesTable).where(and(eq(pollChoicesTable.id, data.choiceId!), eq(pollChoicesTable.pollId, data.pollId!)));
        if (!poll || !choice) throw new Error("Poll is no longer available");
        if (poll.startedAt.getTime() + poll.durationSeconds * 1000 <= Date.now()) {
          await tx.update(pollsTable).set({ status: "ended", endedAt: new Date() }).where(eq(pollsTable.id, poll.id));
          throw new Error("Poll has ended");
        }
        const inserted = await tx.insert(pollVotesTable).values({ pollId: poll.id, choiceId: choice.id, userId }).onConflictDoNothing().returning({ id: pollVotesTable.id });
        if (!inserted.length) throw new Error("You have already voted in this poll");
        await tx.update(pollChoicesTable).set({ votes: sql`${pollChoicesTable.votes} + 1` }).where(eq(pollChoicesTable.id, choice.id));
      });
      res.json({ action: data.action, status: "recorded" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to record vote" });
    }
    return;
  }

  if (data.action === "end_poll") {
    if (!data.pollId) { res.status(400).json({ error: "A poll is required." }); return; }
    await db.update(pollsTable).set({ status: "ended", endedAt: new Date() }).where(and(eq(pollsTable.id, data.pollId), eq(pollsTable.channelId, channelId)));
    res.json({ action: data.action, status: "ended" });
    return;
  }

  if (data.action === "create_prediction") {
    if (!data.title || !data.choices) { res.status(400).json({ error: "A prediction title and at least two outcomes are required." }); return; }
    const prediction = await db.transaction(async (tx) => {
      await tx.update(predictionsTable).set({ status: "ended", endedAt: new Date() }).where(and(eq(predictionsTable.channelId, channelId), eq(predictionsTable.status, "active")));
      const [created] = await tx.insert(predictionsTable).values({ channelId, title: data.title!, predictionWindowSeconds: data.durationSeconds ?? 120 }).returning();
      await tx.insert(predictionOutcomesTable).values(data.choices!.map((title, index) => ({ predictionId: created.id, title, color: index === 0 ? "BLUE" : "PINK" })));
      return created;
    });
    res.status(201).json({ action: data.action, entityId: prediction.id });
    return;
  }

  if (data.action === "enter_prediction") {
    if (!data.predictionId || !data.outcomeId || !data.channelPoints) { res.status(400).json({ error: "Prediction, outcome, and point amount are required." }); return; }
    try {
      await db.transaction(async (tx) => {
        const [prediction] = await tx.select().from(predictionsTable).where(and(eq(predictionsTable.id, data.predictionId!), eq(predictionsTable.channelId, channelId), eq(predictionsTable.status, "active")));
        const [outcome] = await tx.select().from(predictionOutcomesTable).where(and(eq(predictionOutcomesTable.id, data.outcomeId!), eq(predictionOutcomesTable.predictionId, data.predictionId!)));
        if (!prediction || !outcome) throw new Error("Prediction is no longer available");
        if (prediction.startedAt.getTime() + prediction.predictionWindowSeconds * 1000 <= Date.now()) {
          await tx.update(predictionsTable).set({ status: "locked", lockedAt: new Date() }).where(eq(predictionsTable.id, prediction.id));
          throw new Error("Prediction entries are locked");
        }
        const [points] = await tx.update(channelPointsTable).set({ balance: sql`${channelPointsTable.balance} - ${data.channelPoints}` }).where(and(eq(channelPointsTable.channelId, channelId), eq(channelPointsTable.userId, userId), gte(channelPointsTable.balance, data.channelPoints))).returning();
        if (!points) throw new Error("Insufficient channel points");
        const inserted = await tx.insert(predictionEntriesTable).values({ predictionId: prediction.id, outcomeId: outcome.id, userId, channelPointsUsed: data.channelPoints }).onConflictDoNothing().returning({ id: predictionEntriesTable.id });
        if (!inserted.length) throw new Error("You have already entered this prediction");
        await tx.update(predictionOutcomesTable).set({ channelPoints: sql`${predictionOutcomesTable.channelPoints} + ${data.channelPoints}`, users: sql`${predictionOutcomesTable.users} + 1` }).where(eq(predictionOutcomesTable.id, outcome.id));
      });
      res.json({ action: data.action, status: "entered" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to enter prediction" });
    }
    return;
  }

  if (data.action === "lock_prediction") {
    if (!data.predictionId) { res.status(400).json({ error: "A prediction is required." }); return; }
    await db.update(predictionsTable).set({ status: "locked", lockedAt: new Date() }).where(and(eq(predictionsTable.id, data.predictionId), eq(predictionsTable.channelId, channelId), eq(predictionsTable.status, "active")));
    res.json({ action: data.action, status: "locked" });
    return;
  }

  if (data.action === "resolve_prediction") {
    if (!data.predictionId || !data.outcomeId) { res.status(400).json({ error: "A prediction and winning outcome are required." }); return; }
    try {
      await db.transaction(async (tx) => {
        const [prediction] = await tx.select().from(predictionsTable).where(and(eq(predictionsTable.id, data.predictionId!), eq(predictionsTable.channelId, channelId), eq(predictionsTable.status, "locked")));
        const [winner] = await tx.select().from(predictionOutcomesTable).where(and(eq(predictionOutcomesTable.id, data.outcomeId!), eq(predictionOutcomesTable.predictionId, data.predictionId!)));
        if (!prediction || !winner) throw new Error("Prediction cannot be resolved");
        const outcomes = await tx.select().from(predictionOutcomesTable).where(eq(predictionOutcomesTable.predictionId, prediction.id));
        const totalPool = outcomes.reduce((total, outcome) => total + outcome.channelPoints, 0);
        const winningPool = winner.channelPoints;
        const entries = await tx.select().from(predictionEntriesTable).where(eq(predictionEntriesTable.predictionId, prediction.id));
        for (const entry of entries.filter((entry) => entry.outcomeId === winner.id)) {
          const payout = winningPool > 0 ? Math.floor((entry.channelPointsUsed * totalPool) / winningPool) : entry.channelPointsUsed;
          await tx.update(channelPointsTable).set({ balance: sql`${channelPointsTable.balance} + ${payout}`, totalEarned: sql`${channelPointsTable.totalEarned} + ${payout}` }).where(and(eq(channelPointsTable.channelId, channelId), eq(channelPointsTable.userId, entry.userId)));
        }
        await tx.update(predictionsTable).set({ status: "resolved", winningOutcomeId: winner.id, endedAt: new Date() }).where(eq(predictionsTable.id, prediction.id));
      });
      res.json({ action: data.action, status: "resolved" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to resolve prediction" });
    }
    return;
  }

  if (data.action === "raid") {
    if (!data.targetChannelId || data.targetChannelId === channelId) { res.status(400).json({ error: "Choose a different live channel to raid." }); return; }
    const [target] = await db.select().from(channelsTable).where(and(eq(channelsTable.id, data.targetChannelId), eq(channelsTable.isLive, true)));
    if (!target) { res.status(400).json({ error: "Raid target must be live." }); return; }
    const [raid] = await db.insert(raidsTable).values({ fromChannelId: channelId, toChannelId: target.id, viewerCount: owned.channel.viewerCount, status: "completed", completedAt: new Date() }).returning();
    logActivity(req, "channel_raid", { raidId: raid.id, channelId, targetChannelId: target.id }).catch(console.error);
    res.status(201).json({ action: data.action, entityId: raid.id, targetChannelId: target.id });
    return;
  }

  if (data.action === "set_host") {
    if (!data.targetChannelId || data.targetChannelId === channelId) { res.status(400).json({ error: "Choose a different channel to host." }); return; }
    const [target] = await db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.id, data.targetChannelId));
    if (!target) { res.status(404).json({ error: "Host target not found." }); return; }
    await db.transaction(async (tx) => {
      await tx.delete(hostsTable).where(eq(hostsTable.hostChannelId, channelId));
      await tx.insert(hostsTable).values({ hostChannelId: channelId, hostedChannelId: target.id, autoHost: data.autoHost ?? false });
    });
    res.json({ action: data.action, targetChannelId: target.id });
    return;
  }

  if (data.action === "clear_host") {
    await db.delete(hostsTable).where(eq(hostsTable.hostChannelId, channelId));
    res.json({ action: data.action, status: "cleared" });
    return;
  }

  res.status(400).json({ error: "Unsupported engagement action." });
});

export default router;

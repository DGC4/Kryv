import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, channelsTable, followsTable } from "@workspace/db";
import { GetMeResponse } from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { toChannelSummary } from "../lib/channelSerializer";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const user = await getOrCreateUser(userId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [ownChannel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, userId));

  const followedRows = await db
    .select({ channel: channelsTable })
    .from(followsTable)
    .innerJoin(channelsTable, eq(followsTable.channelId, channelsTable.id))
    .where(eq(followsTable.followerUserId, userId));

  const followedChannels = await Promise.all(
    followedRows.map((r) => toChannelSummary(r.channel)),
  );

  res.json(
    GetMeResponse.parse({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      channel: ownChannel ? await toChannelSummary(ownChannel) : null,
      followedChannels,
    }),
  );
});

export default router;

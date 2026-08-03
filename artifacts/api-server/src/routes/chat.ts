import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, channelsTable, chatMessagesTable, usersTable } from "@workspace/db";
import {
  ListChannelMessagesParams,
  ListChannelMessagesResponse,
  CreateChannelMessageParams,
  CreateChannelMessageBody,
  CreateChannelMessageResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/channels/:id/messages",
  async (req, res): Promise<void> => {
    const params = ListChannelMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const rows = await db
      .select({ message: chatMessagesTable, user: usersTable })
      .from(chatMessagesTable)
      .innerJoin(usersTable, eq(chatMessagesTable.userId, usersTable.id))
      .where(eq(chatMessagesTable.channelId, channel.id))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(200);

    res.json(
      ListChannelMessagesResponse.parse(
        rows.map((r) => ({
          id: r.message.id,
          channelId: r.message.channelId,
          userId: r.message.userId.toString(),
          username: r.user.username,
          avatarUrl: r.user.avatarUrl,
          message: r.message.message,
          createdAt: r.message.createdAt,
        })),
      ),
    );
  },
);

router.post(
  "/channels/:id/messages",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const params = CreateChannelMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateChannelMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [channel] = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, params.data.id));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const [message] = await db
      .insert(chatMessagesTable)
      .values({
        channelId: channel.id,
        userId,
        message: parsed.data.message,
      })
      .returning();

    res.status(201).json(
      CreateChannelMessageResponse.parse({
        id: message.id,
        channelId: message.channelId,
        userId: message.userId.toString(),
        username: user?.username ?? "viewer",
        avatarUrl: user?.avatarUrl ?? null,
        message: message.message,
        createdAt: message.createdAt,
      }),
    );
  },
);

export default router;

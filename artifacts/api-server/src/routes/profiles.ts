import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  channelsTable,
  cinemaCreditsTable,
  db,
  streamSessionsTable,
  usersTable,
  videosTable,
} from "@workspace/db";
import {
  GetCreatorProfileParams,
  GetCreatorProfileResponse,
  GetUserProfileParams,
  GetUserProfileResponse,
} from "@workspace/api-zod";
import { attachUserId } from "../lib/auth";
import { toChannelDetail } from "../lib/channelSerializer";
import { toVideoSummary } from "../lib/videoSerializer";
import { getPublishedCinemaTitles } from "../lib/cinemaCatalog";

const router: IRouter = Router();

router.get("/profiles/:slug", attachUserId, async (req, res): Promise<void> => {
  const params = GetCreatorProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.slug, params.data.slug))
    .limit(1);

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const [watchRows, recentStreams, creditRows] = await Promise.all([
    db.select()
      .from(videosTable)
      .where(and(
        eq(videosTable.channelId, channel.id),
        eq(videosTable.contentType, "upload"),
        eq(videosTable.uploadStatus, "ready"),
      ))
      .orderBy(desc(videosTable.createdAt)),
    db.select({
      id: streamSessionsTable.id,
      title: streamSessionsTable.title,
      startedAt: streamSessionsTable.startedAt,
      endedAt: streamSessionsTable.endedAt,
      durationSeconds: streamSessionsTable.durationSeconds,
    })
      .from(streamSessionsTable)
      .where(eq(streamSessionsTable.channelId, channel.id))
      .orderBy(desc(streamSessionsTable.startedAt))
      .limit(6),
    db.select()
      .from(cinemaCreditsTable)
      .where(eq(cinemaCreditsTable.channelId, channel.id))
      .orderBy(cinemaCreditsTable.displayOrder, desc(cinemaCreditsTable.createdAt)),
  ]);

  const publicTitlesById = new Map(
    creditRows.length
      ? (await getPublishedCinemaTitles()).map((title) => [title.id, title])
      : [],
  );
  const cinemaCredits = creditRows.flatMap((credit) => {
    const title = publicTitlesById.get(credit.cinemaTitleId);
    return title ? [{ ...title, role: credit.role }] : [];
  });

  const [channelDetail, watch] = await Promise.all([
    toChannelDetail(channel, req.user?.userId),
    Promise.all(watchRows.map(toVideoSummary)),
  ]);

  res.json(GetCreatorProfileResponse.parse({
    channel: channelDetail,
    live: {
      isLive: channel.isLive,
      streamTitle: channel.streamTitle,
      viewerCount: channel.viewerCount,
      categoryName: channelDetail.categoryName,
      recentStreams,
    },
    watch,
    cinemaCredits,
  }));
});

router.get("/profiles/users/:username", async (req, res): Promise<void> => {
  const params = GetUserProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.username, params.data.username))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "Kryv account not found." });
    return;
  }

  const [channel] = await db
    .select({
      id: channelsTable.id,
      slug: channelsTable.slug,
      displayName: channelsTable.displayName,
      avatarUrl: channelsTable.avatarUrl,
      isLive: channelsTable.isLive,
      streamTitle: channelsTable.streamTitle,
      viewerCount: channelsTable.viewerCount,
      followerCount: channelsTable.followerCount,
    })
    .from(channelsTable)
    .where(eq(channelsTable.ownerUserId, user.id))
    .limit(1);

  res.json(GetUserProfileResponse.parse({
    ...user,
    role: user.role === "owner" ? "owner" : "user",
    creatorChannel: channel ?? null,
  }));
});

export default router;

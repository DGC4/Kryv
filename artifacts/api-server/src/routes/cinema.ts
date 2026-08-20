import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  categoriesTable,
  cinemaCommentsTable,
  cinemaTitlesTable,
  db,
  usersTable,
  viewerProfilesTable,
} from "@workspace/db";
import {
  CreateCinemaCommentBody,
  CreateCinemaCommentParams,
  CreateCinemaCommentResponse,
  DeleteCinemaCommentParams,
  GetCinemaHomeResponse,
  GetCinemaTitleParams,
  GetCinemaTitleResponse,
  ListCinemaCommentsParams,
  ListCinemaCommentsQueryParams,
  ListCinemaCommentsResponse,
} from "@workspace/api-zod";
import { attachUserId, requireAuth } from "../lib/auth";
import {
  getPublishedCinemaTitleDetail,
  getPublishedCinemaTitles,
  type PublicCinemaTitle,
} from "../lib/cinemaCatalog";
import { writeAuditLog } from "../lib/operations";

const router: IRouter = Router();

const maturityRank = { kids: 0, standard: 1, mature: 2 } as const;

type PublishedCinemaTitle = Awaited<
  ReturnType<typeof getPublishedCinemaTitleDetail>
>;

function restrictCinemaPlayback(
  title: NonNullable<PublishedCinemaTitle>,
  playbackBlockedReason: string,
) {
  return {
    ...title,
    featurePlaybackId: null,
    trailerPlaybackId: null,
    playbackAvailable: false,
    playbackBlockedReason,
  };
}

function toCinemaCatalogCard(title: PublicCinemaTitle) {
  return {
    ...title,
    featurePlaybackId: null,
    trailerPlaybackId: null,
    playbackAvailable: false,
    playbackBlockedReason:
      "Select an eligible profile and title to request Cinema playback.",
  };
}

async function getCinemaProfileMaturity(
  req: Parameters<typeof attachUserId>[0],
) {
  if (!req.user || !req.activeProfileId) return null;
  const [profile] = await db
    .select({ maturityLevel: viewerProfilesTable.maturityLevel })
    .from(viewerProfilesTable)
    .where(
      and(
        eq(viewerProfilesTable.id, req.activeProfileId),
        eq(viewerProfilesTable.userId, req.user.userId),
      ),
    )
    .limit(1);
  const maturityLevel = profile?.maturityLevel as
    keyof typeof maturityRank | undefined;
  return maturityLevel && maturityRank[maturityLevel] !== undefined
    ? maturityLevel
    : null;
}

async function getCinemaDiscussionRestriction(
  req: Parameters<typeof attachUserId>[0],
  titleMaturity: string,
) {
  if (!req.user || !req.activeProfileId) {
    return "Select a viewer profile to access Cinema discussion.";
  }
  const profileMaturity = await getCinemaProfileMaturity(req);
  const profileMaturityRank = profileMaturity
    ? maturityRank[profileMaturity]
    : undefined;
  const titleMaturityRank =
    maturityRank[titleMaturity as keyof typeof maturityRank];
  if (
    profileMaturityRank === undefined ||
    titleMaturityRank === undefined ||
    profileMaturityRank < titleMaturityRank
  ) {
    return "This Cinema discussion is outside the active profile's maturity setting.";
  }
  return null;
}

async function getPublishedCinemaTitle(id: number) {
  const [title] = await db
    .select({
      id: cinemaTitlesTable.id,
      title: cinemaTitlesTable.title,
      maturityLevel: cinemaTitlesTable.maturityLevel,
    })
    .from(cinemaTitlesTable)
    .where(
      and(
        eq(cinemaTitlesTable.id, id),
        eq(cinemaTitlesTable.publishState, "published"),
      ),
    )
    .limit(1);
  return title ?? null;
}

router.get("/cinema/home", attachUserId, async (req, res): Promise<void> => {
  const [publishedTitles, genres] = await Promise.all([
    getPublishedCinemaTitles(),
    db.select().from(categoriesTable).where(eq(categoriesTable.kind, "genre")),
  ]);
  const profileMaturity = await getCinemaProfileMaturity(req);
  const profileFilteredTitles = req.user
    ? profileMaturity
      ? publishedTitles.filter(
          (title) =>
            maturityRank[title.maturityLevel] <= maturityRank[profileMaturity],
        )
      : []
    : publishedTitles;
  const catalogTitles = profileFilteredTitles.map(toCinemaCatalogCard);

  const rows = [
    { title: "New on Kryv", items: catalogTitles },
    ...genres.map((genre) => ({
      title: genre.name,
      items: catalogTitles.filter((title) =>
        title.genres.some(
          (value) => value.toLowerCase() === genre.name.toLowerCase(),
        ),
      ),
    })),
  ].filter((row) => row.items.length > 0);

  res.json(
    GetCinemaHomeResponse.parse({ hero: catalogTitles[0] ?? null, rows }),
  );
});

router.get(
  "/cinema/titles/:id",
  attachUserId,
  async (req, res): Promise<void> => {
    const parsed = GetCinemaTitleParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const title = await getPublishedCinemaTitleDetail(parsed.data.id);
    if (!title) {
      res.status(404).json({ error: "Cinema title is unavailable" });
      return;
    }

    if (!req.user || !req.activeProfileId) {
      res.json(
        GetCinemaTitleResponse.parse(
          restrictCinemaPlayback(
            title,
            "Select a viewer profile to request Cinema playback.",
          ),
        ),
      );
      return;
    }

    const profileMaturity = await getCinemaProfileMaturity(req);
    const titleMaturity = title.maturityLevel as keyof typeof maturityRank;
    const profileMaturityRank = profileMaturity
      ? maturityRank[profileMaturity]
      : undefined;
    const titleMaturityRank = maturityRank[titleMaturity];
    if (
      profileMaturityRank === undefined ||
      titleMaturityRank === undefined ||
      profileMaturityRank < titleMaturityRank
    ) {
      res.json(
        GetCinemaTitleResponse.parse(
          restrictCinemaPlayback(
            title,
            "This title is outside the active profile's maturity setting.",
          ),
        ),
      );
      return;
    }

    res.json(GetCinemaTitleResponse.parse(title));
  },
);

router.get(
  "/cinema/titles/:id/comments",
  attachUserId,
  async (req, res): Promise<void> => {
    const params = ListCinemaCommentsParams.safeParse(req.params);
    const query = ListCinemaCommentsQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const title = await getPublishedCinemaTitle(params.data.id);
    if (!title) {
      res.status(404).json({ error: "Published Cinema title not found." });
      return;
    }
    const restriction = await getCinemaDiscussionRestriction(
      req,
      title.maturityLevel,
    );
    if (restriction) {
      res.status(403).json({ error: restriction });
      return;
    }

    const commentFields = {
      id: cinemaCommentsTable.id,
      cinemaTitleId: cinemaCommentsTable.cinemaTitleId,
      parentCommentId: cinemaCommentsTable.parentCommentId,
      userId: cinemaCommentsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      message: cinemaCommentsTable.message,
      createdAt: cinemaCommentsTable.createdAt,
    };
    const rootWhere = and(
      eq(cinemaCommentsTable.cinemaTitleId, title.id),
      isNull(cinemaCommentsTable.parentCommentId),
      isNull(cinemaCommentsTable.deletedAt),
    );
    const [rootRows, countRows] = await Promise.all([
      db
        .select(commentFields)
        .from(cinemaCommentsTable)
        .innerJoin(usersTable, eq(usersTable.id, cinemaCommentsTable.userId))
        .where(rootWhere)
        .orderBy(
          desc(cinemaCommentsTable.createdAt),
          desc(cinemaCommentsTable.id),
        )
        .limit(query.data.limit)
        .offset(query.data.offset),
      db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(cinemaCommentsTable)
        .where(rootWhere),
    ]);
    const rootIds = rootRows.map((row) => row.id);
    const replyRows = rootIds.length === 0
      ? []
      : await db
        .select(commentFields)
        .from(cinemaCommentsTable)
        .innerJoin(usersTable, eq(usersTable.id, cinemaCommentsTable.userId))
        .where(and(
          eq(cinemaCommentsTable.cinemaTitleId, title.id),
          inArray(cinemaCommentsTable.parentCommentId, rootIds),
          isNull(cinemaCommentsTable.deletedAt),
        ))
        .orderBy(
          desc(cinemaCommentsTable.createdAt),
          desc(cinemaCommentsTable.id),
        );

    type CommentNode = (typeof rootRows)[number] & {
      replies: Array<(typeof rootRows)[number] & { replies: [] }>;
    };
    const parentComments = new Map<number, CommentNode>(
      rootRows.map((row) => [row.id, { ...row, replies: [] }]),
    );
    for (const reply of replyRows) {
      const parent = parentComments.get(reply.parentCommentId!);
      if (parent) parent.replies.push({ ...reply, replies: [] });
    }

    res.json(
      ListCinemaCommentsResponse.parse({
        items: rootRows.map((row) => parentComments.get(row.id)!),
        total: countRows[0]?.total ?? 0,
        limit: query.data.limit,
        offset: query.data.offset,
      }),
    );
  },
);

router.post(
  "/cinema/titles/:id/comments",
  attachUserId,
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateCinemaCommentParams.safeParse(req.params);
    const body = CreateCinemaCommentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : (body.error?.message ?? "Invalid Cinema comment body"),
      });
      return;
    }

    const message = body.data.message.trim();
    if (!message) {
      res.status(400).json({ error: "A comment cannot be empty." });
      return;
    }

    const title = await getPublishedCinemaTitle(params.data.id);
    if (!title) {
      res.status(404).json({ error: "Published Cinema title not found." });
      return;
    }
    const restriction = await getCinemaDiscussionRestriction(
      req,
      title.maturityLevel,
    );
    if (restriction) {
      res.status(403).json({ error: restriction });
      return;
    }

    if (body.data.parentCommentId) {
      const [parent] = await db
        .select({
          cinemaTitleId: cinemaCommentsTable.cinemaTitleId,
          parentCommentId: cinemaCommentsTable.parentCommentId,
          deletedAt: cinemaCommentsTable.deletedAt,
        })
        .from(cinemaCommentsTable)
        .where(eq(cinemaCommentsTable.id, body.data.parentCommentId))
        .limit(1);
      if (
        !parent ||
        parent.cinemaTitleId !== title.id ||
        parent.deletedAt ||
        parent.parentCommentId !== null
      ) {
        res.status(400).json({
          error:
            "Replies must target a visible top-level comment on this Cinema title.",
        });
        return;
      }
    }

    const [created] = await db
      .insert(cinemaCommentsTable)
      .values({
        cinemaTitleId: title.id,
        userId: req.user!.userId,
        parentCommentId: body.data.parentCommentId ?? null,
        message,
      })
      .returning();
    const [author] = await db
      .select({
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, created.userId))
      .limit(1);

    await writeAuditLog(req, {
      action: "cinema_comment_created",
      targetType: "cinema_comment",
      targetId: created.id,
      afterState: {
        cinemaTitleId: title.id,
        parentCommentId: created.parentCommentId,
      },
    });

    res.status(201).json(
      CreateCinemaCommentResponse.parse({
        id: created.id,
        cinemaTitleId: created.cinemaTitleId,
        parentCommentId: created.parentCommentId,
        userId: created.userId,
        username: author?.username ?? "Kryv viewer",
        avatarUrl: author?.avatarUrl ?? null,
        message: created.message,
        createdAt: created.createdAt,
        replies: [],
      }),
    );
  },
);

router.delete(
  "/cinema/titles/:id/comments/:commentId",
  attachUserId,
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteCinemaCommentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    if (req.user!.role !== "owner") {
      const title = await getPublishedCinemaTitle(params.data.id);
      const restriction = title
        ? await getCinemaDiscussionRestriction(req, title.maturityLevel)
        : "Published Cinema title not found.";
      if (restriction) {
        res.status(403).json({ error: restriction });
        return;
      }
    }

    const [comment] = await db
      .select({ comment: cinemaCommentsTable })
      .from(cinemaCommentsTable)
      .where(
        and(
          eq(cinemaCommentsTable.id, params.data.commentId),
          eq(cinemaCommentsTable.cinemaTitleId, params.data.id),
        ),
      )
      .limit(1);
    if (!comment || comment.comment.deletedAt) {
      res.status(404).json({ error: "Cinema comment not found." });
      return;
    }
    if (
      comment.comment.userId !== req.user!.userId &&
      req.user!.role !== "owner"
    ) {
      res.status(403).json({
        error:
          "Only the comment author or owner can remove this Cinema comment.",
      });
      return;
    }

    const deletedAt = new Date();
    await db
      .update(cinemaCommentsTable)
      .set({ deletedAt, deletedByUserId: req.user!.userId })
      .where(
        or(
          eq(cinemaCommentsTable.id, comment.comment.id),
          eq(cinemaCommentsTable.parentCommentId, comment.comment.id),
        ),
      );

    await writeAuditLog(req, {
      action: "cinema_comment_deleted",
      targetType: "cinema_comment",
      targetId: comment.comment.id,
      afterState: {
        cinemaTitleId: params.data.id,
        deletedAt: deletedAt.toISOString(),
        removedByOwner:
          req.user!.role === "owner" &&
          comment.comment.userId !== req.user!.userId,
      },
    });

    res.sendStatus(204);
  },
);

export default router;

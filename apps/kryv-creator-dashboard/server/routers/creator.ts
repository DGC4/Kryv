import { z } from "zod";
import {
  getCreatorDashboard,
  rotateCreatorStreamKey,
  updateCreatorNotifications,
  updateCreatorProfile,
  updateCreatorStream,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const profileInput = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.union([z.literal(""), z.string().url().max(2048)]).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color."),
});

const streamInput = z.object({
  streamTitle: z.string().trim().max(140),
  category: z.string().trim().max(80).optional(),
});

const notificationInput = z.object({
  streamAlerts: z.boolean(),
  followerAlerts: z.boolean(),
  revenueAlerts: z.boolean(),
  weeklyDigest: z.boolean(),
});

export const creatorRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => getCreatorDashboard(ctx.user.id, ctx.user.name ?? undefined)),
  profile: router({
    update: protectedProcedure.input(profileInput).mutation(({ ctx, input }) =>
      updateCreatorProfile(ctx.user.id, input, ctx.user.name ?? undefined),
    ),
  }),
  stream: router({
    update: protectedProcedure.input(streamInput).mutation(({ ctx, input }) =>
      updateCreatorStream(ctx.user.id, input, ctx.user.name ?? undefined),
    ),
    rotateKey: protectedProcedure.mutation(({ ctx }) =>
      rotateCreatorStreamKey(ctx.user.id, ctx.user.name ?? undefined),
    ),
  }),
  notifications: router({
    update: protectedProcedure.input(notificationInput).mutation(({ ctx, input }) =>
      updateCreatorNotifications(ctx.user.id, input, ctx.user.name ?? undefined),
    ),
  }),
});

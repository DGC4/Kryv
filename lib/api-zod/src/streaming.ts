import { z } from "zod";

export const SubscribeBody = z.object({
  tier: z.number().int().min(1).max(3).default(1),
});

export const SubscribeResponse = z.object({
  id: z.number(),
  userId: z.number(),
  channelId: z.number(),
  tier: z.number(),
  status: z.string(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const TipBody = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  message: z.string().max(500).optional(),
});

export const TipResponse = z.object({
  id: z.number(),
  senderUserId: z.number().nullable(),
  receiverChannelId: z.number(),
  amount: z.string(),
  currency: z.string(),
  message: z.string().nullable(),
  createdAt: z.date(),
});

export const EmoteResponse = z.object({
  id: z.number(),
  channelId: z.number().nullable(),
  code: z.string(),
  imageUrl: z.string(),
  isGlobal: z.boolean(),
  createdAt: z.date(),
});

export const ListEmotesResponse = z.array(EmoteResponse);

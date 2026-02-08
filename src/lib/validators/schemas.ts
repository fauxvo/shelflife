import { z } from "zod";
import { COMMON_SORTS } from "@/lib/db/sorting";

export const voteSchema = z
  .object({
    vote: z.enum(["delete", "trim"]),
    keepSeasons: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.vote !== "trim" || data.keepSeasons !== undefined, {
    message: "keepSeasons is required when vote is 'trim'",
    path: ["keepSeasons"],
  });

export const syncRequestSchema = z.object({
  type: z.enum(["overseerr", "tautulli", "full"]).default("full"),
});

export const mediaQuerySchema = z.object({
  type: z.enum(["movie", "tv", "all"]).default("all"),
  status: z
    .enum(["available", "pending", "processing", "partial", "unknown", "removed", "all"])
    .default("all"),
  vote: z.enum(["nominated", "none", "all"]).default("all"),
  search: z.string().max(200).optional(),
  watched: z.enum(["true", "false", ""]).optional(),
  sort: z.enum(COMMON_SORTS).default("title_asc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const communityVoteSchema = z.object({
  vote: z.enum(["keep"]),
});

export const communityQuerySchema = z.object({
  type: z.enum(["movie", "tv", "all"]).default("all"),
  unvoted: z.enum(["true", "false", ""]).optional(),
  sort: z.enum(["least_keep", "oldest_unwatched", "newest", ...COMMON_SORTS]).default("least_keep"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const adminUserRequestsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  vote: z.enum(["nominated", "none", "delete", "trim", "all"]).default("all"),
  watched: z.enum(["true", "false", ""]).optional(),
});

export const reviewRoundCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

export const reviewActionSchema = z.object({
  mediaItemId: z.coerce.number().int().positive(),
  action: z.enum(["remove", "keep", "skip"]),
});

export type VoteInput = z.infer<typeof voteSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type MediaQuery = z.infer<typeof mediaQuerySchema>;
export type CommunityVoteInput = z.infer<typeof communityVoteSchema>;
export type CommunityQuery = z.infer<typeof communityQuerySchema>;
export type AdminUserRequestsQuery = z.infer<typeof adminUserRequestsQuerySchema>;
export type ReviewRoundCreate = z.infer<typeof reviewRoundCreateSchema>;
export type ReviewActionInput = z.infer<typeof reviewActionSchema>;

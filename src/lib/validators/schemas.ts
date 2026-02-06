import { z } from "zod";

export const voteSchema = z.object({
  vote: z.enum(["keep", "delete"]),
});

export const syncRequestSchema = z.object({
  type: z.enum(["overseerr", "tautulli", "full"]).default("full"),
});

export const mediaQuerySchema = z.object({
  type: z.enum(["movie", "tv", "all"]).default("all"),
  status: z
    .enum(["available", "pending", "processing", "partial", "unknown", "all"])
    .default("all"),
  vote: z.enum(["keep", "delete", "none", "all"]).default("all"),
  watched: z.enum(["true", "false", ""]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const adminCandidatesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  sort: z.enum(["vote", "watched", "title"]).default("vote"),
});

export type VoteInput = z.infer<typeof voteSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type MediaQuery = z.infer<typeof mediaQuerySchema>;
export type AdminCandidatesQuery = z.infer<typeof adminCandidatesQuerySchema>;

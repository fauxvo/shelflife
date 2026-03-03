import { z } from "zod";

/**
 * Coerce bigint strings (from PostgreSQL aggregates) to numbers.
 * Tracearr returns some numeric fields as strings when they come from
 * PostgreSQL bigint columns (e.g., durationMs, totalDurationMs, progressMs).
 */
const bigintToNumber = z.preprocess((val) => {
  if (typeof val === "string") return Number(val);
  return val;
}, z.number());

const tracearrSessionSchema = z.object({
  id: z.string().or(z.number()).optional(),
  serverId: z.string().nullish(),
  serverName: z.string().nullish(),
  state: z.string().nullish(),
  mediaTitle: z.string(),
  mediaType: z.string(),
  showTitle: z.string().nullish(),
  seasonNumber: z.number().nullish(),
  episodeNumber: z.number().nullish(),
  year: z.number().nullish(),
  thumbPath: z.string().nullish(),
  posterUrl: z.string().nullish(),
  durationMs: bigintToNumber,
  progressMs: bigintToNumber.optional(),
  totalDurationMs: bigintToNumber,
  watched: z.boolean(),
  segmentCount: z.number().nullish(),
  device: z.string().nullish(),
  player: z.string().nullish(),
  product: z.string().nullish(),
  platform: z.string().nullish(),
  isTranscode: z.boolean().nullish(),
  videoDecision: z.string().nullish(),
  audioDecision: z.string().nullish(),
  bitrate: bigintToNumber.nullish(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    thumbUrl: z.string().nullish(),
    avatarUrl: z.string().nullish(),
  }),
  startedAt: z.string(),
  stoppedAt: z.string().nullish(),
});

const tracearrUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullish(),
  sessionCount: z.number(),
  lastActivityAt: z.string().nullish(),
  role: z.string().nullish(),
  serverId: z.string().nullish(),
  serverName: z.string().nullish(),
  createdAt: z.string().nullish(),
});

/**
 * Tracearr Public API uses `meta` (not `pagination`) for paginated responses.
 * Shape: { total: number, page: number, pageSize: number }
 * Note: no `totalPages` field — must be calculated from total / pageSize.
 */
const tracearrMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const tracearrPaginatedResponseSchema = z.object({
  data: z.array(z.unknown()),
  meta: tracearrMetaSchema.optional(),
});

export type TracearrSession = z.infer<typeof tracearrSessionSchema>;
export type TracearrUser = z.infer<typeof tracearrUserSchema>;

/** Maximum page size allowed by Tracearr's public API */
const MAX_PAGE_SIZE = 100;

class TracearrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { url: string; apiKey: string }) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async fetch(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Tracearr API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  async getHistory(
    page = 1,
    pageSize = MAX_PAGE_SIZE,
    startDate?: string,
    endDate?: string
  ): Promise<{ sessions: TracearrSession[]; total: number }> {
    const params: Record<string, string> = {
      page: String(page),
      pageSize: String(Math.min(pageSize, MAX_PAGE_SIZE)),
    };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const json = await this.fetch("/api/v1/public/history", params);
    const parsed = tracearrPaginatedResponseSchema.parse(json);
    const sessions = z.array(tracearrSessionSchema).parse(parsed.data);
    const total = parsed.meta?.total ?? sessions.length;

    return { sessions, total };
  }

  async getAllHistory(): Promise<TracearrSession[]> {
    const allSessions: TracearrSession[] = [];
    let page = 1;

    while (true) {
      const { sessions, total } = await this.getHistory(page, MAX_PAGE_SIZE);
      allSessions.push(...sessions);

      const totalPages = Math.ceil(total / MAX_PAGE_SIZE);
      if (page >= totalPages || sessions.length < MAX_PAGE_SIZE) break;
      page++;
    }

    return allSessions;
  }

  async getUsers(): Promise<TracearrUser[]> {
    const json = await this.fetch("/api/v1/public/users");
    const parsed = tracearrPaginatedResponseSchema.parse(json);
    return z.array(tracearrUserSchema).parse(parsed.data);
  }

  async healthCheck(): Promise<{ success: boolean }> {
    try {
      await this.fetch("/api/v1/public/health");
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}

export function createTracearrClient(config: { url: string; apiKey: string }): TracearrClient {
  return new TracearrClient(config);
}

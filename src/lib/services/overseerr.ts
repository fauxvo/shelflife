import { z } from "zod";

const overseerrUserSchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  plexUsername: z.string().optional(),
  username: z.string().optional(),
  plexId: z.number().optional(),
  avatar: z.string().optional(),
  requestCount: z.number().optional(),
});

const overseerrMediaInfoSchema = z.object({
  id: z.number().optional(),
  tmdbId: z.number().optional(),
  tvdbId: z.number().optional(),
  status: z.number().optional(),
  ratingKey: z.string().optional(),
  externalServiceId: z.number().optional(),
});

const overseerrRequestSchema = z.object({
  id: z.number(),
  status: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  type: z.enum(["movie", "tv"]),
  media: z.object({
    id: z.number().optional(),
    tmdbId: z.number().optional(),
    tvdbId: z.number().optional(),
    status: z.number().optional(),
    mediaType: z.string().optional(),
    ratingKey: z.string().optional(),
    externalServiceSlug: z.string().optional(),
  }).optional(),
  requestedBy: overseerrUserSchema.optional(),
  mediaInfo: overseerrMediaInfoSchema.optional(),
});

const overseerrPageSchema = z.object({
  pageInfo: z.object({
    pages: z.number(),
    pageSize: z.number(),
    results: z.number(),
    page: z.number(),
  }),
  results: z.array(overseerrRequestSchema),
});

const overseerrUserPageSchema = z.object({
  pageInfo: z.object({
    pages: z.number(),
    pageSize: z.number(),
    results: z.number(),
    page: z.number(),
  }),
  results: z.array(overseerrUserSchema),
});

// Media info response with title
const overseerrMediaDetailSchema = z.object({
  id: z.number(),
  mediaType: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  originalTitle: z.string().optional(),
  originalName: z.string().optional(),
  posterPath: z.string().optional(),
  overview: z.string().optional(),
});

export type OverseerrRequest = z.infer<typeof overseerrRequestSchema>;
export type OverseerrUser = z.infer<typeof overseerrUserSchema>;

type MediaStatusValue = "unknown" | "pending" | "processing" | "partial" | "available";

const MEDIA_STATUS_MAP: Record<number, MediaStatusValue> = {
  1: "unknown",
  2: "pending",
  3: "processing",
  4: "partial",
  5: "available",
};

export function mapMediaStatus(status: number | undefined): MediaStatusValue {
  return MEDIA_STATUS_MAP[status ?? 1] || "unknown";
}

class OverseerrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const url = process.env.OVERSEERR_URL;
    const key = process.env.OVERSEERR_API_KEY;
    if (!url || !key) {
      throw new Error("OVERSEERR_URL and OVERSEERR_API_KEY must be set");
    }
    this.baseUrl = url.replace(/\/$/, "");
    this.apiKey = key;
  }

  private async fetch(path: string) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Overseerr API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async getRequests(take = 20, skip = 0): Promise<z.infer<typeof overseerrPageSchema>> {
    const data = await this.fetch(
      `/api/v1/request?take=${take}&skip=${skip}&sort=added&filter=all`
    );
    return overseerrPageSchema.parse(data);
  }

  async getAllRequests(): Promise<OverseerrRequest[]> {
    const allRequests: OverseerrRequest[] = [];
    let skip = 0;
    const take = 50;

    while (true) {
      const page = await this.getRequests(take, skip);
      allRequests.push(...page.results);
      if (skip + take >= page.pageInfo.results) break;
      skip += take;
    }

    return allRequests;
  }

  async getMediaDetails(
    tmdbId: number,
    mediaType: string
  ): Promise<z.infer<typeof overseerrMediaDetailSchema>> {
    const data = await this.fetch(`/api/v1/${mediaType}/${tmdbId}`);
    return overseerrMediaDetailSchema.parse(data);
  }

  async getUsers(): Promise<OverseerrUser[]> {
    const allUsers: OverseerrUser[] = [];
    let page = 1;

    while (true) {
      const data = await this.fetch(`/api/v1/user?take=50&skip=${(page - 1) * 50}`);
      const parsed = overseerrUserPageSchema.parse(data);
      allUsers.push(...parsed.results);
      if (page >= parsed.pageInfo.pages) break;
      page++;
    }

    return allUsers;
  }
}

let client: OverseerrClient | null = null;

export function getOverseerrClient(): OverseerrClient {
  if (!client) {
    client = new OverseerrClient();
  }
  return client;
}

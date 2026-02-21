import { z } from "zod";

const seerrUserSchema = z.object({
  id: z.number(),
  email: z.string().nullish(),
  plexUsername: z.string().nullish(),
  username: z.string().nullish(),
  plexId: z.number().nullish(),
  avatar: z.string().nullish(),
  requestCount: z.number().nullish(),
});

const seerrMediaInfoSchema = z.object({
  id: z.number().nullish(),
  tmdbId: z.number().nullish(),
  tvdbId: z.number().nullish(),
  status: z.number().nullish(),
  ratingKey: z.string().nullish(),
  externalServiceId: z.number().nullish(),
});

const seerrRequestSchema = z.object({
  id: z.number(),
  status: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  type: z.enum(["movie", "tv"]),
  media: z
    .object({
      id: z.number().nullish(),
      tmdbId: z.number().nullish(),
      tvdbId: z.number().nullish(),
      status: z.number().nullish(),
      mediaType: z.string().nullish(),
      ratingKey: z.string().nullish(),
      externalServiceSlug: z.string().nullish(),
    })
    .nullish(),
  requestedBy: seerrUserSchema.nullish(),
  mediaInfo: seerrMediaInfoSchema.nullish(),
});

const seerrPageSchema = z.object({
  pageInfo: z.object({
    pages: z.number(),
    pageSize: z.number(),
    results: z.number(),
    page: z.number(),
  }),
  results: z.array(seerrRequestSchema),
});

const seerrUserPageSchema = z.object({
  pageInfo: z.object({
    pages: z.number(),
    pageSize: z.number(),
    results: z.number(),
    page: z.number(),
  }),
  results: z.array(seerrUserSchema),
});

// Media info response with title
const seerrMediaDetailSchema = z.object({
  id: z.number(),
  mediaType: z.string().nullish(),
  title: z.string().nullish(),
  name: z.string().nullish(),
  originalTitle: z.string().nullish(),
  originalName: z.string().nullish(),
  posterPath: z.string().nullish(),
  overview: z.string().nullish(),
  imdbId: z.string().nullish(),
  numberOfSeasons: z.number().nullish(),
  externalIds: z
    .object({
      imdbId: z.string().nullish(),
    })
    .nullish(),
  mediaInfo: z
    .object({
      seasons: z
        .array(
          z.object({
            seasonNumber: z.number(),
            status: z.number(),
          })
        )
        .nullish(),
    })
    .nullish(),
});

export type SeerrRequest = z.infer<typeof seerrRequestSchema>;
export type SeerrUser = z.infer<typeof seerrUserSchema>;

type MediaStatusValue = "unknown" | "pending" | "processing" | "partial" | "available";

const MEDIA_STATUS_MAP: Record<number, MediaStatusValue> = {
  1: "unknown",
  2: "pending",
  3: "processing",
  4: "partial",
  5: "available",
};

export function mapMediaStatus(status: number | null | undefined): MediaStatusValue {
  return MEDIA_STATUS_MAP[status ?? 1] || "unknown";
}

class SeerrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const url = process.env.SEERR_URL;
    const key = process.env.SEERR_API_KEY;
    if (!url || !key) {
      throw new Error("SEERR_URL and SEERR_API_KEY must be set");
    }
    this.baseUrl = url.replace(/\/$/, "");
    this.apiKey = key;
  }

  private async fetch(path: string, options?: RequestInit) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`Seerr API error: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async deleteMedia(overseerrMediaId: number): Promise<void> {
    await this.fetch(`/api/v1/media/${overseerrMediaId}`, { method: "DELETE" });
  }

  async getRequests(take = 20, skip = 0): Promise<z.infer<typeof seerrPageSchema>> {
    const data = await this.fetch(
      `/api/v1/request?take=${take}&skip=${skip}&sort=added&filter=all`
    );
    return seerrPageSchema.parse(data);
  }

  async getAllRequests(): Promise<SeerrRequest[]> {
    const allRequests: SeerrRequest[] = [];
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
  ): Promise<z.infer<typeof seerrMediaDetailSchema>> {
    const data = await this.fetch(`/api/v1/${mediaType}/${tmdbId}`);
    return seerrMediaDetailSchema.parse(data);
  }

  async getUsers(): Promise<SeerrUser[]> {
    const allUsers: SeerrUser[] = [];
    let page = 1;

    while (true) {
      const data = await this.fetch(`/api/v1/user?take=50&skip=${(page - 1) * 50}`);
      const parsed = seerrUserPageSchema.parse(data);
      allUsers.push(...parsed.results);
      if (page >= parsed.pageInfo.pages) break;
      page++;
    }

    return allUsers;
  }
}

let client: SeerrClient | null = null;

export function getSeerrClient(): SeerrClient {
  if (!client) {
    client = new SeerrClient();
  }
  return client;
}

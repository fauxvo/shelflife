import { z } from "zod";

/**
 * Unified client for Overseerr/Seerr/Jellyseerr — all three share the same API surface.
 * The `providerLabel` is used only in error messages (e.g., "Overseerr API error: 500").
 */

const userSchema = z.object({
  id: z.number(),
  email: z.string().nullish(),
  plexUsername: z.string().nullish(),
  username: z.string().nullish(),
  plexId: z.number().nullish(),
  avatar: z.string().nullish(),
  requestCount: z.number().nullish(),
});

const requestSchema = z.object({
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
  requestedBy: userSchema.nullish(),
  mediaInfo: z
    .object({
      id: z.number().nullish(),
      tmdbId: z.number().nullish(),
      tvdbId: z.number().nullish(),
      status: z.number().nullish(),
      ratingKey: z.string().nullish(),
      externalServiceId: z.number().nullish(),
    })
    .nullish(),
});

const pageSchema = z.object({
  pageInfo: z.object({
    pages: z.number(),
    pageSize: z.number(),
    results: z.number(),
    page: z.number(),
  }),
  results: z.array(requestSchema),
});

const userPageSchema = z.object({
  pageInfo: z.object({
    pages: z.number(),
    pageSize: z.number(),
    results: z.number(),
    page: z.number(),
  }),
  results: z.array(userSchema),
});

const mediaDetailSchema = z.object({
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

export type SeerrServiceRequest = z.infer<typeof requestSchema>;
export type SeerrServiceUser = z.infer<typeof userSchema>;

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

class SeerrServiceClient {
  private baseUrl: string;
  private apiKey: string;
  private label: string;

  constructor(label: string, config: { url: string; apiKey: string }) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.label = label;
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
      throw new Error(`${this.label} API error: ${res.status} ${res.statusText}`);
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

  async getRequests(take = 20, skip = 0): Promise<z.infer<typeof pageSchema>> {
    const data = await this.fetch(
      `/api/v1/request?take=${take}&skip=${skip}&sort=added&filter=all`
    );
    return pageSchema.parse(data);
  }

  async getAllRequests(): Promise<SeerrServiceRequest[]> {
    const allRequests: SeerrServiceRequest[] = [];
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
  ): Promise<z.infer<typeof mediaDetailSchema>> {
    const data = await this.fetch(`/api/v1/${mediaType}/${tmdbId}`);
    return mediaDetailSchema.parse(data);
  }

  async getUsers(): Promise<SeerrServiceUser[]> {
    const allUsers: SeerrServiceUser[] = [];
    let page = 1;

    while (true) {
      const data = await this.fetch(`/api/v1/user?take=50&skip=${(page - 1) * 50}`);
      const parsed = userPageSchema.parse(data);
      allUsers.push(...parsed.results);
      if (page >= parsed.pageInfo.pages) break;
      page++;
    }

    return allUsers;
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  seerr: "Seerr",
  overseerr: "Overseerr",
  jellyseerr: "Jellyseerr",
};

export function createSeerrServiceClient(
  provider: string,
  config: { url: string; apiKey: string }
): SeerrServiceClient {
  return new SeerrServiceClient(PROVIDER_LABELS[provider] ?? provider, config);
}

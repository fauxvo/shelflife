import { z } from "zod";

const tautulliResponseSchema = z.object({
  response: z.object({
    result: z.string(),
    message: z.string().nullable().optional(),
    data: z.any(),
  }),
});

const tautulliHistoryRecordSchema = z.object({
  reference_id: z.number().optional(),
  user_id: z.number().optional(),
  user: z.string().optional(),
  rating_key: z.union([z.string(), z.number()]).optional(),
  parent_rating_key: z.union([z.string(), z.number()]).optional(),
  grandparent_rating_key: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  full_title: z.string().optional(),
  watched_status: z.number().optional(),
  play_count: z.number().optional(),
  stopped: z.number().optional(),
});

const tautulliUserSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  friendly_name: z.string().optional(),
  email: z.string().optional(),
  thumb: z.string().optional(),
});

const tautulliLibraryMediaSchema = z.object({
  rating_key: z.string().optional(),
  title: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  media_type: z.string().optional(),
  last_played: z.union([z.string(), z.number()]).optional(),
  play_count: z.union([z.string(), z.number()]).optional(),
  file_size: z.union([z.string(), z.number()]).optional(),
});

export type TautulliHistoryRecord = z.infer<typeof tautulliHistoryRecordSchema>;

class TautulliClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const url = process.env.TAUTULLI_URL;
    const key = process.env.TAUTULLI_API_KEY;
    if (!url || !key) {
      throw new Error("TAUTULLI_URL and TAUTULLI_API_KEY must be set");
    }
    this.baseUrl = url.replace(/\/$/, "");
    this.apiKey = key;
  }

  private async fetch(cmd: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}/api/v2`);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set("cmd", cmd);
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Tautulli API error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const parsed = tautulliResponseSchema.parse(json);

    if (parsed.response.result !== "success") {
      throw new Error(`Tautulli error: ${parsed.response.message}`);
    }

    return parsed.response.data;
  }

  async getHistory(
    ratingKey?: string,
    userId?: number,
    length = 100
  ): Promise<TautulliHistoryRecord[]> {
    const params: Record<string, string> = { length: String(length) };
    if (ratingKey) params.rating_key = ratingKey;
    if (userId) params.user_id = String(userId);

    const data = await this.fetch("get_history", params);
    if (!data?.data) return [];

    return z.array(tautulliHistoryRecordSchema).parse(data.data);
  }

  async getWatchStatusForItem(
    ratingKey: string
  ): Promise<{ watched: boolean; playCount: number; lastWatchedAt: string | null }[]> {
    const records = await this.getHistory(ratingKey);

    const byUser = new Map<
      number,
      { watched: boolean; playCount: number; lastWatchedAt: string | null }
    >();

    for (const record of records) {
      const uid = record.user_id;
      if (!uid) continue;

      const existing = byUser.get(uid) || {
        watched: false,
        playCount: 0,
        lastWatchedAt: null,
      };

      existing.playCount += 1;
      if (record.watched_status === 1) existing.watched = true;
      if (record.stopped) {
        const date = new Date(record.stopped * 1000).toISOString();
        if (!existing.lastWatchedAt || date > existing.lastWatchedAt) {
          existing.lastWatchedAt = date;
        }
      }

      byUser.set(uid, existing);
    }

    return Array.from(byUser.values());
  }

  async getUsers() {
    const data = await this.fetch("get_users");
    if (!Array.isArray(data)) return [];
    return z.array(tautulliUserSchema).parse(data);
  }

  async getLibraryMediaInfo(sectionId: string, length = 1000) {
    const data = await this.fetch("get_library_media_info", {
      section_id: sectionId,
      length: String(length),
    });
    if (!data?.data) return [];
    return z.array(tautulliLibraryMediaSchema).parse(data.data);
  }

  async getMetadata(ratingKey: string) {
    const data = await this.fetch("get_metadata", { rating_key: ratingKey });
    return data;
  }
}

let client: TautulliClient | null = null;

export function getTautulliClient(): TautulliClient {
  if (!client) {
    client = new TautulliClient();
  }
  return client;
}

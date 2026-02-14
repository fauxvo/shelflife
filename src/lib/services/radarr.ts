class RadarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const url = process.env.RADARR_URL;
    const key = process.env.RADARR_API_KEY;
    if (!url || !key) {
      throw new Error("RADARR_URL and RADARR_API_KEY must be set");
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
      throw new Error(`Radarr API error: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async lookupByTmdbId(tmdbId: number): Promise<Record<string, unknown> | null> {
    const data = await this.fetch(`/api/v3/movie?tmdbId=${tmdbId}`);
    const results = data as Record<string, unknown>[];
    return results[0] ?? null;
  }

  async deleteMovie(radarrId: number, deleteFiles: boolean): Promise<void> {
    await this.fetch(
      `/api/v3/movie/${radarrId}?deleteFiles=${deleteFiles}&addImportExclusion=true`,
      { method: "DELETE" }
    );
  }
}

export function isRadarrConfigured(): boolean {
  return !!(process.env.RADARR_URL && process.env.RADARR_API_KEY);
}

let client: RadarrClient | null = null;

export function getRadarrClient(): RadarrClient {
  if (!client) {
    client = new RadarrClient();
  }
  return client;
}

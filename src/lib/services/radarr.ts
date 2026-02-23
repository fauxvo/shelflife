interface RadarrMovie {
  id: number;
  title: string;
  [key: string]: unknown;
}

class RadarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { url: string; apiKey: string }) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.apiKey = config.apiKey;
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

  async lookupByTmdbId(tmdbId: number): Promise<RadarrMovie | null> {
    const data = await this.fetch(`/api/v3/movie?tmdbId=${tmdbId}`);
    if (!Array.isArray(data)) return null;
    return data[0] ?? null;
  }

  async deleteMovie(radarrId: number, deleteFiles: boolean): Promise<void> {
    await this.fetch(
      `/api/v3/movie/${radarrId}?deleteFiles=${deleteFiles}&addImportExclusion=true`,
      { method: "DELETE" }
    );
  }
}

export function createRadarrClient(config: { url: string; apiKey: string }): RadarrClient {
  return new RadarrClient(config);
}

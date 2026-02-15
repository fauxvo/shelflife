interface SonarrSeries {
  id: number;
  title: string;
  [key: string]: unknown;
}

class SonarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const url = process.env.SONARR_URL;
    const key = process.env.SONARR_API_KEY;
    if (!url || !key) {
      throw new Error("SONARR_URL and SONARR_API_KEY must be set");
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
      throw new Error(`Sonarr API error: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async lookupByTvdbId(tvdbId: number): Promise<SonarrSeries | null> {
    const data = await this.fetch(`/api/v3/series?tvdbId=${tvdbId}`);
    if (!Array.isArray(data)) return null;
    return data[0] ?? null;
  }

  async deleteSeries(sonarrId: number, deleteFiles: boolean): Promise<void> {
    await this.fetch(
      `/api/v3/series/${sonarrId}?deleteFiles=${deleteFiles}&addImportListExclusion=true`,
      { method: "DELETE" }
    );
  }
}

export function isSonarrConfigured(): boolean {
  return !!(process.env.SONARR_URL && process.env.SONARR_API_KEY);
}

let client: SonarrClient | null = null;

export function getSonarrClient(): SonarrClient {
  if (!client) {
    client = new SonarrClient();
  }
  return client;
}

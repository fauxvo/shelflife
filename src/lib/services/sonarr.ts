/** Image object shared by Sonarr and Radarr APIs. */
export interface ArrImage {
  coverType: string;
  remoteUrl?: string;
  url?: string;
}

export interface SonarrSeriesStatistics {
  episodeFileCount: number;
  episodeCount: number;
  seasonCount?: number;
  sizeOnDisk: number;
}

export interface SonarrSeriesFull {
  id: number;
  title: string;
  tvdbId?: number;
  tmdbId?: number;
  imdbId?: string;
  images: ArrImage[];
  sizeOnDisk: number;
  added: string;
  seasonCount: number;
  statistics?: SonarrSeriesStatistics;
  status: string;
}

interface SonarrSeries {
  id: number;
  title: string;
  [key: string]: unknown;
}

/**
 * Extract poster URL from Sonarr images array.
 * Sonarr stores TVDB artwork as full URLs in remoteUrl.
 */
export function extractSonarrPoster(images: ArrImage[]): string | null {
  const poster = images.find((img) => img.coverType === "poster");
  return poster?.remoteUrl || poster?.url || null;
}

class SonarrClient {
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
      throw new Error(`Sonarr API error: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async getAllSeries(): Promise<SonarrSeriesFull[]> {
    const data = await this.fetch("/api/v3/series");
    if (!Array.isArray(data)) return [];
    return data;
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

export function createSonarrClient(config: { url: string; apiKey: string }): SonarrClient {
  return new SonarrClient(config);
}

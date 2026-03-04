import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestData } from "@/test/helpers/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { mediaItems } from "@/lib/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const mockGetAllSeries = vi.fn();
const mockGetAllMovies = vi.fn();
const mockGetAllRequests = vi.fn();
const mockGetMediaDetails = vi.fn();

vi.mock("../sonarr", () => ({
  createSonarrClient: () => ({
    getAllSeries: mockGetAllSeries,
  }),
  extractSonarrPoster: (images: { coverType: string; remoteUrl?: string }[]) => {
    const poster = images.find((img) => img.coverType === "poster");
    return poster?.remoteUrl || null;
  },
}));

vi.mock("../radarr", () => ({
  createRadarrClient: () => ({
    getAllMovies: mockGetAllMovies,
  }),
  extractRadarrPoster: (images: { coverType: string; remoteUrl?: string }[]) => {
    const poster = images.find((img) => img.coverType === "poster");
    if (!poster?.remoteUrl) return null;
    try {
      return new URL(poster.remoteUrl).pathname;
    } catch {
      return null;
    }
  },
}));

vi.mock("../seerr-client", () => ({
  mapMediaStatus: (status: number | null | undefined) => {
    const map: Record<number, string> = { 5: "available" };
    return map[status ?? 1] || "unknown";
  },
}));

vi.mock("../request-service", () => ({
  getRequestServiceClient: () =>
    Promise.resolve({
      getAllRequests: mockGetAllRequests,
      getMediaDetails: mockGetMediaDetails,
      getUsers: vi.fn().mockResolvedValue([]),
    }),
  getProviderLabel: () => Promise.resolve("Overseerr"),
  getActiveProvider: () => Promise.resolve("overseerr"),
}));

vi.mock("../service-config", () => ({
  getServiceConfig: vi.fn((type: string) => {
    if (type === "sonarr") {
      return Promise.resolve({ url: "http://sonarr:8989", apiKey: "sonarr-key" });
    }
    if (type === "radarr") {
      return Promise.resolve({ url: "http://radarr:7878", apiKey: "radarr-key" });
    }
    return Promise.resolve(null);
  }),
  getActiveStatsProvider: vi.fn(() => Promise.resolve("tautulli")),
}));

// Mock Tautulli/Tracearr to prevent interference
vi.mock("../tautulli", () => ({
  createTautulliClient: () => ({
    getHistory: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
    getLibraries: vi.fn().mockResolvedValue([]),
    getLibraryMediaInfo: vi.fn().mockResolvedValue([]),
    getServerInfo: vi.fn().mockResolvedValue({ pmsUrl: "http://localhost:32400" }),
  }),
}));

vi.mock("../tracearr", () => ({
  createTracearrClient: () => ({
    getAllHistory: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

const { syncSonarr, syncRadarr, enrichFromSeerr } = await import("../sync");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockGetAllSeries.mockReset();
  mockGetAllMovies.mockReset();
  mockGetAllRequests.mockReset();
  mockGetMediaDetails.mockReset();
});

// ---------------------------------------------------------------------------
// syncSonarr
// ---------------------------------------------------------------------------

describe("syncSonarr", () => {
  const makeSeries = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    title: "Breaking Bad",
    tvdbId: 81189,
    tmdbId: 1396,
    imdbId: "tt0903747",
    images: [{ coverType: "poster", remoteUrl: "https://artworks.thetvdb.com/poster.jpg" }],
    sizeOnDisk: 50_000_000_000,
    added: "2023-01-15T00:00:00Z",
    seasonCount: 5,
    statistics: { episodeFileCount: 62, episodeCount: 62, sizeOnDisk: 50_000_000_000 },
    status: "ended",
    ...overrides,
  });

  it("upserts series into media_items by sonarrId", async () => {
    mockGetAllSeries.mockResolvedValue([makeSeries()]);

    const count = await syncSonarr();
    expect(count).toBe(1);

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.sonarrId, 1)).all();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Breaking Bad");
    expect(items[0].mediaType).toBe("tv");
    expect(items[0].tmdbId).toBe(1396);
    expect(items[0].tvdbId).toBe(81189);
    expect(items[0].imdbId).toBe("tt0903747");
    expect(items[0].seasonCount).toBe(5);
    expect(items[0].fileSize).toBe(50_000_000_000);
    expect(items[0].status).toBe("available");
    expect(items[0].posterPath).toBe("https://artworks.thetvdb.com/poster.jpg");
  });

  it("updates existing items on re-sync", async () => {
    mockGetAllSeries.mockResolvedValue([makeSeries()]);
    await syncSonarr();

    // Re-sync with updated title
    mockGetAllSeries.mockResolvedValue([makeSeries({ title: "Breaking Bad (Updated)" })]);
    const count = await syncSonarr();
    expect(count).toBe(1);

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.sonarrId, 1)).all();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Breaking Bad (Updated)");
  });

  it("handles empty series response", async () => {
    mockGetAllSeries.mockResolvedValue([]);
    const count = await syncSonarr();
    expect(count).toBe(0);
  });

  it("marks stale items as removed", async () => {
    // First sync — add two series
    mockGetAllSeries.mockResolvedValue([
      makeSeries({ id: 10 }),
      makeSeries({ id: 20, title: "Better Call Saul" }),
    ]);
    await syncSonarr();

    // Second sync — only one series remains
    mockGetAllSeries.mockResolvedValue([makeSeries({ id: 10 })]);
    await syncSonarr();

    const removed = testDb.db
      .select()
      .from(mediaItems)
      .where(and(eq(mediaItems.sonarrId, 20), eq(mediaItems.status, "removed")))
      .all();
    expect(removed).toHaveLength(1);
  });

  it("skips stale removal when Sonarr returns 0 but items exist", async () => {
    // First sync — add a series
    mockGetAllSeries.mockResolvedValue([makeSeries({ id: 10 })]);
    await syncSonarr();

    // Second sync — Sonarr returns empty (e.g., network glitch)
    mockGetAllSeries.mockResolvedValue([]);
    await syncSonarr();

    // Item should NOT be marked as removed (safety guard)
    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.sonarrId, 10)).all();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("available");
  });

  it("sets status to 'available' when all episodes are downloaded", async () => {
    mockGetAllSeries.mockResolvedValue([
      makeSeries({ statistics: { episodeFileCount: 62, episodeCount: 62 } }),
    ]);
    await syncSonarr();

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.sonarrId, 1)).all();
    expect(items[0].status).toBe("available");
  });

  it("sets status to 'partial' when some episodes are missing", async () => {
    mockGetAllSeries.mockResolvedValue([
      makeSeries({ seasonCount: 3, statistics: { episodeFileCount: 10, episodeCount: 30 } }),
    ]);
    await syncSonarr();

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.sonarrId, 1)).all();
    expect(items[0].status).toBe("partial");
    // Sonarr doesn't have per-season download data, so partial shows get null;
    // Seerr enrichment provides accurate per-season counts when available
    expect(items[0].availableSeasonCount).toBeNull();
  });

  it("sets status to 'pending' when no episodes are downloaded", async () => {
    mockGetAllSeries.mockResolvedValue([
      makeSeries({ statistics: { episodeFileCount: 0, episodeCount: 30 } }),
    ]);
    await syncSonarr();

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.sonarrId, 1)).all();
    expect(items[0].status).toBe("pending");
    expect(items[0].availableSeasonCount).toBeNull();
  });

  it("reports progress callbacks", async () => {
    mockGetAllSeries.mockResolvedValue([makeSeries()]);
    const calls: unknown[] = [];
    await syncSonarr((p) => calls.push(p));

    expect(calls.length).toBeGreaterThan(0);
    expect((calls[0] as { phase: string }).phase).toBe("sonarr");
  });

  it("merges duplicate when both legacy and arr items exist for same tmdbId", async () => {
    const sqlite = (testDb.db as any).session.client;
    // Legacy Overseerr item (tmdbId match, no sonarrId) — use high overseerrId to avoid seed conflicts
    sqlite.exec(`
      INSERT INTO media_items (id, overseerr_id, tmdb_id, media_type, title, status)
      VALUES (500, 9000, 1396, 'tv', 'Breaking Bad (legacy)', 'available')
    `);
    // Duplicate *arr item from prior sync (sonarrId=1, same tmdbId)
    sqlite.exec(`
      INSERT INTO media_items (id, sonarr_id, tmdb_id, media_type, title, status)
      VALUES (501, 1, 1396, 'tv', 'Breaking Bad (arr)', 'available')
    `);

    mockGetAllSeries.mockResolvedValue([makeSeries()]);
    const count = await syncSonarr();
    expect(count).toBe(1);

    // Legacy item should survive with sonarrId merged in
    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.tmdbId, 1396)).all();
    const active = items.filter((i) => i.status !== "removed");
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(500);
    expect(active[0].sonarrId).toBe(1);
    expect(active[0].overseerrId).toBe(9000);
  });
});

// ---------------------------------------------------------------------------
// syncRadarr
// ---------------------------------------------------------------------------

describe("syncRadarr", () => {
  const makeMovie = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    title: "The Matrix",
    tmdbId: 603,
    imdbId: "tt0133093",
    images: [{ coverType: "poster", remoteUrl: "https://image.tmdb.org/t/p/original/abc.jpg" }],
    sizeOnDisk: 10_000_000_000,
    added: "2023-02-20T00:00:00Z",
    hasFile: true,
    year: 1999,
    status: "released",
    ...overrides,
  });

  it("upserts movies into media_items by radarrId", async () => {
    mockGetAllMovies.mockResolvedValue([makeMovie()]);

    const count = await syncRadarr();
    expect(count).toBe(1);

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.radarrId, 1)).all();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("The Matrix");
    expect(items[0].mediaType).toBe("movie");
    expect(items[0].tmdbId).toBe(603);
    expect(items[0].imdbId).toBe("tt0133093");
    expect(items[0].fileSize).toBe(10_000_000_000);
    expect(items[0].status).toBe("available");
  });

  it("syncs movies without files as 'pending'", async () => {
    mockGetAllMovies.mockResolvedValue([
      makeMovie({ hasFile: true }),
      makeMovie({ id: 2, title: "No File Movie", tmdbId: 604, hasFile: false, sizeOnDisk: 0 }),
    ]);

    const count = await syncRadarr();
    expect(count).toBe(2);

    const all = testDb.db.select().from(mediaItems).where(isNotNull(mediaItems.radarrId)).all();
    expect(all).toHaveLength(2);

    const downloaded = all.find((i) => i.radarrId === 1);
    expect(downloaded!.status).toBe("available");

    const pending = all.find((i) => i.radarrId === 2);
    expect(pending!.title).toBe("No File Movie");
    expect(pending!.status).toBe("pending");
  });

  it("handles empty movies response", async () => {
    mockGetAllMovies.mockResolvedValue([]);
    const count = await syncRadarr();
    expect(count).toBe(0);
  });

  it("marks stale items as removed", async () => {
    mockGetAllMovies.mockResolvedValue([
      makeMovie({ id: 10 }),
      makeMovie({ id: 20, title: "Old Movie" }),
    ]);
    await syncRadarr();

    // Second sync — only one movie remains
    mockGetAllMovies.mockResolvedValue([makeMovie({ id: 10 })]);
    await syncRadarr();

    const removed = testDb.db
      .select()
      .from(mediaItems)
      .where(and(eq(mediaItems.radarrId, 20), eq(mediaItems.status, "removed")))
      .all();
    expect(removed).toHaveLength(1);
  });

  it("skips stale removal when Radarr returns 0 but items exist", async () => {
    mockGetAllMovies.mockResolvedValue([makeMovie({ id: 10 })]);
    await syncRadarr();

    mockGetAllMovies.mockResolvedValue([]);
    await syncRadarr();

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.radarrId, 10)).all();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("available");
  });

  it("reports progress callbacks", async () => {
    mockGetAllMovies.mockResolvedValue([makeMovie()]);
    const calls: unknown[] = [];
    await syncRadarr((p) => calls.push(p));

    expect(calls.length).toBeGreaterThan(0);
    expect((calls[0] as { phase: string }).phase).toBe("radarr");
  });

  it("merges duplicate when both legacy and arr items exist for same tmdbId", async () => {
    const sqlite = (testDb.db as any).session.client;
    // Legacy Overseerr item (tmdbId match, no radarrId) — use high overseerrId to avoid seed conflicts
    sqlite.exec(`
      INSERT INTO media_items (id, overseerr_id, tmdb_id, media_type, title, status)
      VALUES (600, 9100, 603, 'movie', 'The Matrix (legacy)', 'available')
    `);
    // Duplicate *arr item from prior sync (radarrId=1, same tmdbId)
    sqlite.exec(`
      INSERT INTO media_items (id, radarr_id, tmdb_id, media_type, title, status)
      VALUES (601, 1, 603, 'movie', 'The Matrix (arr)', 'available')
    `);

    mockGetAllMovies.mockResolvedValue([makeMovie()]);
    const count = await syncRadarr();
    expect(count).toBe(1);

    // Legacy item should survive with radarrId merged in
    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.tmdbId, 603)).all();
    const active = items.filter((i) => i.status !== "removed");
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(600);
    expect(active[0].radarrId).toBe(1);
    expect(active[0].overseerrId).toBe(9100);
  });
});

// ---------------------------------------------------------------------------
// enrichFromSeerr
// ---------------------------------------------------------------------------

describe("enrichFromSeerr", () => {
  it("enriches existing items with requester info by tmdbId match", async () => {
    // Pre-populate a Radarr-sourced item
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`
      INSERT INTO media_items (tmdb_id, media_type, title, status, radarr_id)
      VALUES (9999, 'movie', 'Enrichment Test', 'available', 500)
    `);

    mockGetAllRequests.mockResolvedValue([
      {
        id: 1,
        type: "movie",
        createdAt: "2024-01-01",
        media: { id: 300, tmdbId: 9999, status: 5 },
        requestedBy: { plexId: "plex-user-1", plexUsername: "testuser" },
      },
    ]);

    const count = await enrichFromSeerr();
    expect(count).toBe(1);

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.tmdbId, 9999)).all();
    expect(items).toHaveLength(1);
    expect(items[0].overseerrId).toBe(300);
    expect(items[0].requestedByPlexId).toBe("plex-user-1");
    expect(items[0].requestedAt).toBe("2024-01-01");
  });

  it("skips requests with no tmdbId", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 1,
        type: "movie",
        createdAt: "2024-01-01",
        media: { id: 300, status: 5 },
        requestedBy: { plexId: "plex-user-1", plexUsername: "testuser" },
      },
    ]);

    const count = await enrichFromSeerr();
    expect(count).toBe(0);
  });

  it("skips requests with no matching local item", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 1,
        type: "movie",
        createdAt: "2024-01-01",
        media: { id: 300, tmdbId: 99999, status: 5 },
        requestedBy: { plexId: "plex-user-1", plexUsername: "testuser" },
      },
    ]);

    const count = await enrichFromSeerr();
    expect(count).toBe(0);
  });

  it("handles empty request list", async () => {
    mockGetAllRequests.mockResolvedValue([]);
    const count = await enrichFromSeerr();
    expect(count).toBe(0);
  });

  it("reports progress with processed counter reaching total", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 1,
        type: "movie",
        createdAt: "2024-01-01",
        media: { id: 300, tmdbId: 99999, status: 5 },
        requestedBy: { plexId: "plex-user-1", plexUsername: "testuser" },
      },
    ]);

    const calls: { current: number; total: number }[] = [];
    await enrichFromSeerr((p) => calls.push(p));

    // Progress should report processed count (1) against total (1)
    const lastCall = calls[calls.length - 1];
    expect(lastCall.current).toBe(lastCall.total);
  });

  it("merges duplicate items when both legacy and arr items exist for same tmdbId", async () => {
    const sqlite = (testDb.db as any).session.client;
    // Legacy Overseerr item (has overseerrId, no radarrId)
    sqlite.exec(`
      INSERT INTO media_items (id, overseerr_id, tmdb_id, media_type, title, status, rating_key)
      VALUES (200, 300, 8888, 'movie', 'Duplicate Movie', 'available', 'rk-legacy')
    `);
    // *arr item (has radarrId, no overseerrId) — same tmdbId
    sqlite.exec(`
      INSERT INTO media_items (id, radarr_id, tmdb_id, media_type, title, status, file_size)
      VALUES (201, 42, 8888, 'movie', 'Duplicate Movie', 'available', 5000000)
    `);

    mockGetAllRequests.mockResolvedValue([
      {
        id: 1,
        type: "movie",
        createdAt: "2024-06-01",
        media: { id: 300, tmdbId: 8888, status: 5 },
        requestedBy: { plexId: "plex-user-1", plexUsername: "testuser" },
      },
    ]);

    const count = await enrichFromSeerr();
    expect(count).toBe(1);

    // Legacy item should now have both overseerrId AND radarrId merged
    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.tmdbId, 8888)).all();

    // Duplicate should be removed or marked removed — only 1 active item
    const activeItems = items.filter((i) => i.status !== "removed");
    expect(activeItems).toHaveLength(1);

    const merged = activeItems[0];
    expect(merged.id).toBe(200); // legacy item survives
    expect(merged.overseerrId).toBe(300);
    expect(merged.radarrId).toBe(42);
    expect(merged.requestedByPlexId).toBe("plex-user-1");
    expect(merged.ratingKey).toBe("rk-legacy"); // preserved from legacy
    expect(merged.fileSize).toBe(5000000); // merged from arr item
  });

  it("handles enrichment when overseerrId already exists on the same item", async () => {
    const sqlite = (testDb.db as any).session.client;
    // Single item that already has overseerrId (re-enrichment)
    sqlite.exec(`
      INSERT INTO media_items (id, overseerr_id, radarr_id, tmdb_id, media_type, title, status)
      VALUES (300, 500, 42, 7777, 'movie', 'Already Enriched', 'available')
    `);

    mockGetAllRequests.mockResolvedValue([
      {
        id: 2,
        type: "movie",
        createdAt: "2024-06-01",
        media: { id: 500, tmdbId: 7777, status: 5 },
        requestedBy: { plexId: "plex-user-1", plexUsername: "testuser" },
      },
    ]);

    const count = await enrichFromSeerr();
    expect(count).toBe(1);

    const items = testDb.db.select().from(mediaItems).where(eq(mediaItems.tmdbId, 7777)).all();
    expect(items).toHaveLength(1);
    expect(items[0].overseerrId).toBe(500);
    expect(items[0].radarrId).toBe(42);
  });
});

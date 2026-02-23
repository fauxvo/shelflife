import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";

// Declare testDb at module scope so the db mock getter can access it
let testDb: ReturnType<typeof createTestDb>;

const mockGetServiceConfig = vi.fn();
const mockCreateRadarrClient = vi.fn();
const mockCreateSonarrClient = vi.fn();

vi.mock("@/lib/services/service-config", () => ({
  getServiceConfig: (...args: unknown[]) => mockGetServiceConfig(...args),
}));

vi.mock("@/lib/services/radarr", () => ({
  createRadarrClient: (...args: unknown[]) => mockCreateRadarrClient(...args),
}));

vi.mock("@/lib/services/sonarr", () => ({
  createSonarrClient: (...args: unknown[]) => mockCreateSonarrClient(...args),
}));

vi.mock("@/lib/services/request-service", () => ({
  getRequestServiceClient: vi.fn(() =>
    Promise.resolve({
      deleteMedia: vi.fn(),
    })
  ),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

beforeEach(() => {
  testDb = createTestDb();
  vi.restoreAllMocks();

  // Reset mocks with defaults
  mockGetServiceConfig.mockReset();
  mockCreateRadarrClient.mockReset();
  mockCreateSonarrClient.mockReset();

  // Seed test data: a user and media items
  const sqlite = (testDb.db as any).session.client;
  sqlite.exec(`
    INSERT INTO users (plex_id, username, is_admin) VALUES ('admin-1', 'admin', 1);
    INSERT INTO media_items (id, overseerr_id, tmdb_id, tvdb_id, media_type, title, status, requested_by_plex_id)
    VALUES
      (1, 100, 5000, NULL, 'movie', 'Test Movie', 'available', 'admin-1'),
      (2, 101, NULL, 3000, 'tv', 'Test Show', 'available', 'admin-1'),
      (3, 102, 6000, NULL, 'movie', 'No External', 'available', 'admin-1');
  `);
});

describe("executeMediaDeletion", () => {
  it("deletes movie via Radarr and Overseerr", async () => {
    const { getRequestServiceClient } = await import("@/lib/services/request-service");
    const { executeMediaDeletion } = await import("../deletion");

    // Radarr configured, Sonarr not
    mockGetServiceConfig.mockImplementation(async (type: string) => {
      if (type === "radarr") return { url: "http://radarr:7878", apiKey: "key" };
      return null;
    });

    const mockRadarrClient = {
      lookupByTmdbId: vi.fn().mockResolvedValue({ id: 42 }),
      deleteMovie: vi.fn().mockResolvedValue(undefined),
    };
    mockCreateRadarrClient.mockReturnValue(mockRadarrClient);

    const mockOverseerrClient = { deleteMedia: vi.fn().mockResolvedValue(undefined) };
    (getRequestServiceClient as any).mockResolvedValue(mockOverseerrClient);

    const result = await executeMediaDeletion({
      mediaItemId: 1,
      deleteFiles: true,
      deletedByPlexId: "admin-1",
    });

    expect(result.radarr.attempted).toBe(true);
    expect(result.radarr.success).toBe(true);
    expect(result.overseerr.attempted).toBe(true);
    expect(result.overseerr.success).toBe(true);
    expect(result.sonarr.attempted).toBe(false);

    // Verify media_items status updated to removed
    const sqlite = (testDb.db as any).session.client;
    const row = sqlite.prepare("SELECT status FROM media_items WHERE id = 1").get();
    expect(row.status).toBe("removed");

    // Verify deletion_log entry exists
    const logRow = sqlite.prepare("SELECT * FROM deletion_log WHERE media_item_id = 1").get();
    expect(logRow).toBeTruthy();
    expect(logRow.radarr_success).toBe(1);
    expect(logRow.overseerr_success).toBe(1);
  });

  it("deletes TV via Sonarr and Overseerr", async () => {
    const { getRequestServiceClient } = await import("@/lib/services/request-service");
    const { executeMediaDeletion } = await import("../deletion");

    // Sonarr configured, Radarr not
    mockGetServiceConfig.mockImplementation(async (type: string) => {
      if (type === "sonarr") return { url: "http://sonarr:8989", apiKey: "key" };
      return null;
    });

    const mockSonarrClient = {
      lookupByTvdbId: vi.fn().mockResolvedValue({ id: 55 }),
      deleteSeries: vi.fn().mockResolvedValue(undefined),
    };
    mockCreateSonarrClient.mockReturnValue(mockSonarrClient);

    const mockOverseerrClient = { deleteMedia: vi.fn().mockResolvedValue(undefined) };
    (getRequestServiceClient as any).mockResolvedValue(mockOverseerrClient);

    const result = await executeMediaDeletion({
      mediaItemId: 2,
      deleteFiles: true,
      deletedByPlexId: "admin-1",
    });

    expect(result.sonarr.attempted).toBe(true);
    expect(result.sonarr.success).toBe(true);
    expect(result.overseerr.attempted).toBe(true);
    expect(result.overseerr.success).toBe(true);
    expect(result.radarr.attempted).toBe(false);

    // Verify media_items status updated to removed
    const sqlite = (testDb.db as any).session.client;
    const row = sqlite.prepare("SELECT status FROM media_items WHERE id = 2").get();
    expect(row.status).toBe("removed");
  });

  it("handles partial failure (Radarr fails, Overseerr succeeds)", async () => {
    const { getRequestServiceClient } = await import("@/lib/services/request-service");
    const { executeMediaDeletion } = await import("../deletion");

    mockGetServiceConfig.mockImplementation(async (type: string) => {
      if (type === "radarr") return { url: "http://radarr:7878", apiKey: "key" };
      return null;
    });

    const mockRadarrClient = {
      lookupByTmdbId: vi.fn().mockRejectedValue(new Error("Radarr connection refused")),
      deleteMovie: vi.fn(),
    };
    mockCreateRadarrClient.mockReturnValue(mockRadarrClient);

    const mockOverseerrClient = { deleteMedia: vi.fn().mockResolvedValue(undefined) };
    (getRequestServiceClient as any).mockResolvedValue(mockOverseerrClient);

    const result = await executeMediaDeletion({
      mediaItemId: 1,
      deleteFiles: true,
      deletedByPlexId: "admin-1",
    });

    expect(result.radarr.attempted).toBe(true);
    expect(result.radarr.success).toBe(false);
    expect(result.radarr.error).toContain("Radarr connection refused");
    expect(result.overseerr.success).toBe(true);

    // Status should still be updated to removed
    const sqlite = (testDb.db as any).session.client;
    const row = sqlite.prepare("SELECT status FROM media_items WHERE id = 1").get();
    expect(row.status).toBe("removed");
  });

  it("handles item not found in external service as success", async () => {
    const { getRequestServiceClient } = await import("@/lib/services/request-service");
    const { executeMediaDeletion } = await import("../deletion");

    mockGetServiceConfig.mockImplementation(async (type: string) => {
      if (type === "radarr") return { url: "http://radarr:7878", apiKey: "key" };
      return null;
    });

    const mockRadarrClient = {
      lookupByTmdbId: vi.fn().mockResolvedValue(null),
      deleteMovie: vi.fn(),
    };
    mockCreateRadarrClient.mockReturnValue(mockRadarrClient);

    const mockOverseerrClient = { deleteMedia: vi.fn().mockResolvedValue(undefined) };
    (getRequestServiceClient as any).mockResolvedValue(mockOverseerrClient);

    const result = await executeMediaDeletion({
      mediaItemId: 1,
      deleteFiles: true,
      deletedByPlexId: "admin-1",
    });

    // Not found in Radarr is treated as success
    expect(result.radarr.attempted).toBe(true);
    expect(result.radarr.success).toBe(true);
  });

  it("skips Sonarr when not configured", async () => {
    const { getRequestServiceClient } = await import("@/lib/services/request-service");
    const { executeMediaDeletion } = await import("../deletion");

    mockGetServiceConfig.mockResolvedValue(null);

    const mockOverseerrClient = { deleteMedia: vi.fn().mockResolvedValue(undefined) };
    (getRequestServiceClient as any).mockResolvedValue(mockOverseerrClient);

    const result = await executeMediaDeletion({
      mediaItemId: 2,
      deleteFiles: false,
      deletedByPlexId: "admin-1",
    });

    expect(result.sonarr.attempted).toBe(false);
    expect(result.sonarr.success).toBeNull();
  });

  it("throws when media item already removed", async () => {
    const { executeMediaDeletion } = await import("../deletion");

    // Mark item as already removed
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 1`);

    await expect(
      executeMediaDeletion({
        mediaItemId: 1,
        deleteFiles: true,
        deletedByPlexId: "admin-1",
      })
    ).rejects.toThrow("Media item already removed: 1");
  });

  it("throws when media item not found", async () => {
    const { executeMediaDeletion } = await import("../deletion");

    await expect(
      executeMediaDeletion({
        mediaItemId: 999,
        deleteFiles: true,
        deletedByPlexId: "admin-1",
      })
    ).rejects.toThrow("Media item not found: 999");
  });

  it("writes deletion_log with errors", async () => {
    const { getRequestServiceClient } = await import("@/lib/services/request-service");
    const { executeMediaDeletion } = await import("../deletion");

    mockGetServiceConfig.mockImplementation(async (type: string) => {
      if (type === "radarr") return { url: "http://radarr:7878", apiKey: "key" };
      return null;
    });

    const mockRadarrClient = {
      lookupByTmdbId: vi.fn().mockRejectedValue(new Error("Radarr timeout")),
      deleteMovie: vi.fn(),
    };
    mockCreateRadarrClient.mockReturnValue(mockRadarrClient);

    const mockOverseerrClient = { deleteMedia: vi.fn().mockResolvedValue(undefined) };
    (getRequestServiceClient as any).mockResolvedValue(mockOverseerrClient);

    await executeMediaDeletion({
      mediaItemId: 1,
      deleteFiles: true,
      deletedByPlexId: "admin-1",
    });

    const sqlite = (testDb.db as any).session.client;
    const logRow = sqlite.prepare("SELECT * FROM deletion_log WHERE media_item_id = 1").get();
    expect(logRow).toBeTruthy();
    expect(logRow.radarr_success).toBe(0);

    const errors = JSON.parse(logRow.errors);
    expect(errors).toContainEqual(expect.stringContaining("radarr: Radarr timeout"));
  });
});

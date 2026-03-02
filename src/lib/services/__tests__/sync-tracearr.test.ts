import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestData } from "@/test/helpers/db";
import { eq, and } from "drizzle-orm";
import { watchStatus } from "@/lib/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

vi.mock("../overseerr", () => ({
  mapMediaStatus: (status: number | null | undefined) => {
    const map: Record<number, string> = {
      1: "unknown",
      2: "pending",
      3: "processing",
      4: "partial",
      5: "available",
    };
    return map[status ?? 1] || "unknown";
  },
}));

vi.mock("../request-service", () => ({
  getRequestServiceClient: () =>
    Promise.resolve({
      getAllRequests: vi.fn().mockResolvedValue([]),
      getMediaDetails: vi.fn(),
      getUsers: vi.fn().mockResolvedValue([]),
    }),
  getProviderLabel: () => Promise.resolve("Overseerr"),
}));

const mockGetAllHistory = vi.fn();

vi.mock("../tracearr", () => ({
  createTracearrClient: () => ({
    getAllHistory: mockGetAllHistory,
    getUsers: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

// Mock Tautulli to prevent interference
vi.mock("../tautulli", () => ({
  createTautulliClient: () => ({
    getHistory: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
    getWatchStatusForItem: vi.fn(),
    getLibraries: vi.fn().mockResolvedValue([]),
    getLibraryMediaInfo: vi.fn().mockResolvedValue([]),
    getServerInfo: vi.fn().mockResolvedValue({ pmsUrl: "http://localhost:32400" }),
  }),
}));

vi.mock("../service-config", () => ({
  getServiceConfig: vi.fn((type: string) => {
    if (type === "tracearr") {
      return Promise.resolve({ url: "http://tracearr:7880", apiKey: "trr_pub_test" });
    }
    return Promise.resolve(null);
  }),
  getActiveStatsProvider: vi.fn(() => Promise.resolve("tracearr")),
}));

const { syncTracearr } = await import("../sync");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockGetAllHistory.mockReset();
});

describe("syncTracearr", () => {
  it("creates watch_status records from Tracearr history", async () => {
    mockGetAllHistory.mockResolvedValue([
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-01T00:00:00Z",
        stoppedAt: "2024-06-01T02:00:00Z",
      },
    ]);

    const count = await syncTracearr();
    expect(count).toBe(1);

    // Verify watch_status was created
    const rows = testDb.db
      .select()
      .from(watchStatus)
      .where(and(eq(watchStatus.mediaItemId, 1), eq(watchStatus.userPlexId, "plex-user-1")))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].watched).toBe(true);
    expect(rows[0].playCount).toBe(1);
  });

  it("aggregates multiple sessions for the same user and item", async () => {
    mockGetAllHistory.mockResolvedValue([
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 3600000,
        totalDurationMs: 7200000,
        watched: false,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-01T00:00:00Z",
        stoppedAt: "2024-06-01T01:00:00Z",
      },
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-02T00:00:00Z",
        stoppedAt: "2024-06-02T02:00:00Z",
      },
    ]);

    const count = await syncTracearr();
    expect(count).toBe(1);

    const rows = testDb.db
      .select()
      .from(watchStatus)
      .where(and(eq(watchStatus.mediaItemId, 1), eq(watchStatus.userPlexId, "plex-user-1")))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].watched).toBe(true);
    expect(rows[0].playCount).toBe(2);
    expect(rows[0].lastWatchedAt).toBe("2024-06-02T02:00:00Z");
  });

  it("skips sessions with no matching title in DB", async () => {
    mockGetAllHistory.mockResolvedValue([
      {
        mediaTitle: "Unknown Media That Doesn't Exist",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-01T00:00:00Z",
      },
    ]);

    const count = await syncTracearr();
    expect(count).toBe(0);
  });

  it("skips sessions with no matching local user", async () => {
    mockGetAllHistory.mockResolvedValue([
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u99", username: "nonexistent_user" },
        startedAt: "2024-06-01T00:00:00Z",
      },
    ]);

    const count = await syncTracearr();
    expect(count).toBe(0);
  });

  it("handles empty history gracefully", async () => {
    mockGetAllHistory.mockResolvedValue([]);

    const count = await syncTracearr();
    expect(count).toBe(0);
  });

  it("does not inflate play count on repeated syncs", async () => {
    const sessions = [
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-01T00:00:00Z",
        stoppedAt: "2024-06-01T02:00:00Z",
      },
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-02T00:00:00Z",
        stoppedAt: "2024-06-02T02:00:00Z",
      },
    ];

    mockGetAllHistory.mockResolvedValue(sessions);
    await syncTracearr();

    // Re-sync with same data
    mockGetAllHistory.mockResolvedValue(sessions);
    await syncTracearr();

    const rows = testDb.db
      .select()
      .from(watchStatus)
      .where(and(eq(watchStatus.mediaItemId, 1), eq(watchStatus.userPlexId, "plex-user-1")))
      .all();
    expect(rows).toHaveLength(1);
    // Play count should be 2 (from the 2 sessions), NOT 4
    expect(rows[0].playCount).toBe(2);
  });

  it("reports progress callbacks", async () => {
    mockGetAllHistory.mockResolvedValue([
      {
        mediaTitle: "Test Movie 1",
        mediaType: "movie",
        durationMs: 7200000,
        totalDurationMs: 7200000,
        watched: true,
        user: { id: "u1", username: "testuser" },
        startedAt: "2024-06-01T00:00:00Z",
      },
    ]);

    const progressCalls: unknown[] = [];
    await syncTracearr((p) => progressCalls.push(p));

    expect(progressCalls.length).toBeGreaterThan(0);
    expect((progressCalls[0] as { phase: string }).phase).toBe("tracearr");
  });
});

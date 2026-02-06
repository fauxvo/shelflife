import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestData } from "@/test/helpers/db";
import { eq } from "drizzle-orm";
import { syncLog, mediaItems, watchStatus, users } from "@/lib/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const mockGetAllRequests = vi.fn();
const mockGetMediaDetails = vi.fn();
const mockGetOverseerrUsers = vi.fn();

vi.mock("../overseerr", () => ({
  getOverseerrClient: () => ({
    getAllRequests: mockGetAllRequests,
    getMediaDetails: mockGetMediaDetails,
    getUsers: mockGetOverseerrUsers,
  }),
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

const mockGetHistory = vi.fn();
const mockGetTautulliUsers = vi.fn();

vi.mock("../tautulli", () => ({
  getTautulliClient: () => ({
    getHistory: mockGetHistory,
    getUsers: mockGetTautulliUsers,
    getWatchStatusForItem: vi.fn(),
  }),
}));

// Import after mocking
const { syncOverseerr, syncTautulli, runFullSync } = await import("../sync");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockGetAllRequests.mockReset();
  mockGetMediaDetails.mockReset();
  mockGetOverseerrUsers.mockReset();
  mockGetHistory.mockReset();
  mockGetTautulliUsers.mockReset();
});

describe("syncOverseerr", () => {
  it("syncs requests into media_items table", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 200,
        status: 2,
        createdAt: "2024-06-01",
        updatedAt: "2024-06-02",
        type: "movie",
        media: { id: 300, tmdbId: 5000, status: 5, ratingKey: "rk-new" },
        requestedBy: { id: 1, plexId: 999, plexUsername: "newuser" },
      },
    ]);
    mockGetMediaDetails.mockResolvedValue({
      id: 5000,
      title: "New Movie",
      posterPath: "/poster.jpg",
    });

    const count = await syncOverseerr();
    expect(count).toBe(1);

    // Verify it was inserted
    const items = testDb.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.overseerrId, 300))
      .all();
    expect(items.length).toBe(1);
    expect(items[0].title).toBe("New Movie");
  });

  it("upserts user records", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 201,
        status: 2,
        createdAt: "2024-06-01",
        updatedAt: "2024-06-02",
        type: "movie",
        media: { id: 301, tmdbId: 5001, status: 5 },
        requestedBy: { id: 1, plexId: 777, plexUsername: "brandnewuser", email: "new@test.com" },
      },
    ]);
    mockGetMediaDetails.mockResolvedValue({ id: 5001, title: "Title" });

    await syncOverseerr();

    const userList = testDb.db
      .select()
      .from(users)
      .where(eq(users.plexId, "777"))
      .all();
    expect(userList.length).toBe(1);
    expect(userList[0].username).toBe("brandnewuser");
  });

  it("handles getMediaDetails failure gracefully", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 202,
        status: 2,
        createdAt: "2024-06-01",
        updatedAt: "2024-06-02",
        type: "movie",
        media: { id: 302, tmdbId: 5002, status: 5 },
        requestedBy: { id: 1, plexId: 888, plexUsername: "user" },
      },
    ]);
    mockGetMediaDetails.mockRejectedValue(new Error("API timeout"));

    const count = await syncOverseerr();
    expect(count).toBe(1);

    // Should use fallback title
    const items = testDb.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.overseerrId, 302))
      .all();
    expect(items[0].title).toContain("Unknown");
  });

  it("handles null requestedByPlexId", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 203,
        status: 2,
        createdAt: "2024-06-01",
        updatedAt: "2024-06-02",
        type: "tv",
        media: { id: 303, tmdbId: 5003, status: 3 },
        requestedBy: { id: 1, plexId: null },
      },
    ]);
    mockGetMediaDetails.mockResolvedValue({ id: 5003, name: "Show" });

    const count = await syncOverseerr();
    expect(count).toBe(1);
  });

  it("reports progress callbacks", async () => {
    mockGetAllRequests.mockResolvedValue([
      {
        id: 204,
        status: 2,
        createdAt: "2024-06-01",
        updatedAt: "2024-06-02",
        type: "movie",
        media: { id: 304, tmdbId: 5004, status: 5 },
        requestedBy: null,
      },
    ]);
    mockGetMediaDetails.mockResolvedValue({ id: 5004, title: "Movie" });

    const progressCalls: any[] = [];
    await syncOverseerr((p) => progressCalls.push(p));

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0].phase).toBe("overseerr");
  });

  it("returns 0 for empty requests", async () => {
    mockGetAllRequests.mockResolvedValue([]);
    const count = await syncOverseerr();
    expect(count).toBe(0);
  });
});

describe("syncTautulli", () => {
  it("creates watch_status records for matched users", async () => {
    mockGetTautulliUsers.mockResolvedValue([
      { user_id: 10, username: "testuser", friendly_name: "testuser" },
    ]);
    mockGetHistory.mockResolvedValue([
      { user_id: 10, rating_key: "rk-1", watched_status: 1, stopped: 1700000000 },
    ]);

    const count = await syncTautulli();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("skips records with no user_id", async () => {
    mockGetTautulliUsers.mockResolvedValue([
      { user_id: 10, username: "testuser", friendly_name: "testuser" },
    ]);
    mockGetHistory.mockResolvedValue([
      { user_id: null, rating_key: "rk-1", watched_status: 1, stopped: 1700000000 },
    ]);

    const count = await syncTautulli();
    expect(count).toBe(0);
  });

  it("skips records with no matching local user", async () => {
    mockGetTautulliUsers.mockResolvedValue([
      { user_id: 10, username: "unknown_user", friendly_name: "unknown_user" },
    ]);
    mockGetHistory.mockResolvedValue([
      { user_id: 10, rating_key: "rk-1", watched_status: 1, stopped: 1700000000 },
    ]);

    const count = await syncTautulli();
    expect(count).toBe(0);
  });

  it("handles per-item errors gracefully", async () => {
    mockGetTautulliUsers.mockResolvedValue([
      { user_id: 10, username: "testuser", friendly_name: "testuser" },
    ]);
    // First item succeeds, second throws
    mockGetHistory.mockRejectedValueOnce(new Error("API error"));
    mockGetHistory.mockResolvedValueOnce([]);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Should not throw
    const count = await syncTautulli();
    expect(count).toBe(0);
    consoleSpy.mockRestore();
  });
});

describe("runFullSync", () => {
  it("creates sync_log entry with 'running' status", async () => {
    mockGetAllRequests.mockResolvedValue([]);
    mockGetTautulliUsers.mockResolvedValue([]);
    mockGetHistory.mockResolvedValue([]);

    await runFullSync();

    const logs = testDb.db.select().from(syncLog).all();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // Should be completed now
    const lastLog = logs[logs.length - 1];
    expect(lastLog.syncType).toBe("full");
  });

  it("updates to 'completed' on success", async () => {
    mockGetAllRequests.mockResolvedValue([]);
    mockGetTautulliUsers.mockResolvedValue([]);
    mockGetHistory.mockResolvedValue([]);

    await runFullSync();

    const logs = testDb.db.select().from(syncLog).all();
    const lastLog = logs[logs.length - 1];
    expect(lastLog.status).toBe("completed");
    expect(lastLog.completedAt).toBeTruthy();
  });

  it("updates to 'failed' on error with error message", async () => {
    mockGetAllRequests.mockRejectedValue(new Error("Connection refused"));
    mockGetTautulliUsers.mockResolvedValue([]);

    await expect(runFullSync()).rejects.toThrow("Connection refused");

    const logs = testDb.db.select().from(syncLog).all();
    const lastLog = logs[logs.length - 1];
    expect(lastLog.status).toBe("failed");
    expect(lastLog.errors).toContain("Connection refused");
  });

  it("re-throws the error after logging", async () => {
    mockGetAllRequests.mockRejectedValue(new Error("Network error"));
    mockGetTautulliUsers.mockResolvedValue([]);

    await expect(runFullSync()).rejects.toThrow("Network error");
  });

  it("records item count on completion", async () => {
    mockGetAllRequests.mockResolvedValue([]);
    mockGetTautulliUsers.mockResolvedValue([]);
    mockGetHistory.mockResolvedValue([]);

    const result = await runFullSync();
    expect(result).toEqual({ overseerr: 0, tautulli: 0 });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestData } from "@/test/helpers/db";
import { createRequest } from "@/test/helpers/request";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: () => mockRequireAuth(),
  requireAdmin: vi.fn(),
  handleAuthError: (error: unknown) => handleAuthError(error),
  AuthError,
}));

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET } = await import("../route");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAuth.mockReset();
});

const userSession = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };
const otherSession = { userId: 2, plexId: "plex-user-2", username: "otheruser", isAdmin: false };

describe("GET /api/media/stats", () => {
  it("defaults to personal scope stats", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media/stats");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // plex-user-1 has 6 items, 2 nominated (items 2,7), 1 watched (item 1)
    expect(data.total).toBe(6);
    expect(data.nominated).toBe(2);
    expect(data.notNominated).toBe(4);
    expect(data.watched).toBe(1);
  });

  it("returns all-scope stats when scope=all", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media/stats?scope=all");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // 7 total items, plex-user-1 nominated 2, watched 1
    expect(data.total).toBe(7);
    expect(data.nominated).toBe(2);
    expect(data.notNominated).toBe(5);
    expect(data.watched).toBe(1);
  });

  it("returns correct stats for a different user (personal)", async () => {
    mockRequireAuth.mockResolvedValue(otherSession);
    const req = createRequest("http://localhost:3000/api/media/stats?scope=personal");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // plex-user-2 has 1 item (id 5), nominated it, watched it
    expect(data.total).toBe(1);
    expect(data.nominated).toBe(1);
    expect(data.notNominated).toBe(0);
    expect(data.watched).toBe(1);
  });

  it("returns correct stats for a different user (all)", async () => {
    mockRequireAuth.mockResolvedValue(otherSession);
    const req = createRequest("http://localhost:3000/api/media/stats?scope=all");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // 7 total, plex-user-2 nominated 1 (item 5), watched 1 (item 5)
    expect(data.total).toBe(7);
    expect(data.nominated).toBe(1);
    expect(data.notNominated).toBe(6);
    expect(data.watched).toBe(1);
  });

  it("excludes removed items from stats", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Mark an item as removed
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 1`);

    const req = createRequest("http://localhost:3000/api/media/stats?scope=personal");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(5);
  });

  it("returns zeroes for a user with no items", async () => {
    const emptySession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };
    mockRequireAuth.mockResolvedValue(emptySession);
    const req = createRequest("http://localhost:3000/api/media/stats?scope=personal");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(0);
    expect(data.nominated).toBe(0);
    expect(data.notNominated).toBe(0);
    expect(data.watched).toBe(0);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createRequest("http://localhost:3000/api/media/stats");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

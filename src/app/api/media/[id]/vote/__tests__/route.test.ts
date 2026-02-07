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
  console.error("Unexpected error:", error);
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

const { POST } = await import("../route");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAuth.mockReset();
});

const userSession = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };

function createVoteRequest(id: string, vote: string, keepSeasons?: number) {
  const body: Record<string, unknown> = { vote };
  if (keepSeasons !== undefined) body.keepSeasons = keepSeasons;
  return createRequest(`http://localhost:3000/api/media/${id}/vote`, {
    method: "POST",
    body,
  });
}

describe("POST /api/media/:id/vote", () => {
  it("casts 'keep' vote successfully", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("3", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "3" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("keep");
  });

  it("casts 'delete' vote successfully", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("3", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "3" }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.vote).toBe("delete");
  });

  it("updates existing vote (upsert)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("1", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.vote).toBe("delete");
  });

  it("rejects invalid vote value (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("1", "maybe");
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
  });

  it("rejects invalid media ID (NaN) (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("abc", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid media item ID");
  });

  it("rejects vote on non-existent item (404)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("999", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
  });

  it("rejects vote on another user's item (404)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("5", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createVoteRequest("1", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(401);
  });

  it("casts 'trim' vote on multi-season TV show", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Item 7 is "Big Brother" - tv show with 8 seasons, requested by plex-user-1
    const req = createVoteRequest("7", "trim", 1);
    const res = await POST(req, { params: Promise.resolve({ id: "7" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("trim");
    expect(data.keepSeasons).toBe(1);
  });

  it("rejects 'trim' on a movie (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Item 1 is "Test Movie 1" - a movie, not a TV show
    const req = createVoteRequest("1", "trim", 1);
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("TV shows");
  });

  it("rejects 'trim' on single-season show (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Item 4 is "Test Show 2" - tv show with 1 season
    const req = createVoteRequest("4", "trim", 1);
    const res = await POST(req, { params: Promise.resolve({ id: "4" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("more than one season");
  });

  it("rejects 'trim' with keepSeasons >= seasonCount (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Item 3 is "Test Show 1" - tv show with 5 seasons, keepSeasons=5 is invalid
    const req = createVoteRequest("3", "trim", 5);
    const res = await POST(req, { params: Promise.resolve({ id: "3" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("less than");
  });
});

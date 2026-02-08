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

const { POST, DELETE } = await import("../route");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAuth.mockReset();
});

const userSession = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };
const adminSession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };

function createVoteRequest(id: string, vote: string, keepSeasons?: number) {
  const body: Record<string, unknown> = { vote };
  if (keepSeasons !== undefined) body.keepSeasons = keepSeasons;
  return createRequest(`http://localhost:3000/api/media/${id}/vote`, {
    method: "POST",
    body,
  });
}

function createDeleteRequest(id: string) {
  return createRequest(`http://localhost:3000/api/media/${id}/vote`, {
    method: "DELETE",
  });
}

describe("POST /api/media/:id/vote", () => {
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
    // Item 2 already has a "delete" vote; change to "delete" again (same value upsert)
    const req = createVoteRequest("2", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "2" }) });
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

  it("rejects 'keep' vote (no longer valid)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("1", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
  });

  it("rejects invalid media ID (NaN) (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("abc", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid media item ID");
  });

  it("rejects vote on non-existent item (404)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("999", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
  });

  it("rejects vote on another user's item (404)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("5", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createVoteRequest("1", "delete");
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
    const req = createVoteRequest("1", "trim", 1);
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("TV shows");
  });

  it("rejects 'trim' on single-season show (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("4", "trim", 1);
    const res = await POST(req, { params: Promise.resolve({ id: "4" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("more than one season");
  });

  it("allows admin to vote delete on another user's item", async () => {
    mockRequireAuth.mockResolvedValue(adminSession);
    const req = createVoteRequest("1", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("delete");
  });

  it("allows admin to vote trim on another user's TV show", async () => {
    mockRequireAuth.mockResolvedValue(adminSession);
    const req = createVoteRequest("3", "trim", 2);
    const res = await POST(req, { params: Promise.resolve({ id: "3" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("trim");
    expect(data.keepSeasons).toBe(2);
  });

  it("non-admin still cannot vote on another user's item (404)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("5", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(404);
  });

  it("rejects 'trim' with keepSeasons >= seasonCount (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createVoteRequest("3", "trim", 5);
    const res = await POST(req, { params: Promise.resolve({ id: "3" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("less than");
  });
});

describe("DELETE /api/media/:id/vote", () => {
  it("un-nominates successfully", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Item 2 has a "delete" vote from plex-user-1
    const req = createDeleteRequest("2");
    const res = await DELETE(req, { params: Promise.resolve({ id: "2" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(true);
  });

  it("succeeds even if no vote exists, with deleted=false", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    // Item 1 has no vote from plex-user-1 (we removed the "keep" seed)
    const req = createDeleteRequest("1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(false);
  });

  it("rejects un-nominate on non-existent item (404)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createDeleteRequest("999");
    const res = await DELETE(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
  });

  it("rejects un-nominate on another user's item (404) for non-admin", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createDeleteRequest("5");
    const res = await DELETE(req, { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(404);
  });

  it("allows admin to un-nominate on any item", async () => {
    mockRequireAuth.mockResolvedValue(adminSession);
    // First admin nominates item 1
    const voteReq = createVoteRequest("1", "delete");
    await POST(voteReq, { params: Promise.resolve({ id: "1" }) });

    // Then admin un-nominates
    const req = createDeleteRequest("1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(200);
  });

  it("rejects invalid media ID (400)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createDeleteRequest("abc");
    const res = await DELETE(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createDeleteRequest("2");
    const res = await DELETE(req, { params: Promise.resolve({ id: "2" }) });

    expect(res.status).toBe(401);
  });
});

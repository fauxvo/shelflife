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

const otherUser = { userId: 2, plexId: "plex-user-2", username: "otheruser", isAdmin: false };
const adminUser = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };
const requestor = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };

function createVoteRequest(id: string, vote: string) {
  return createRequest(`http://localhost:3000/api/community/${id}/vote`, {
    method: "POST",
    body: { vote },
  });
}

function createDeleteRequest(id: string) {
  return createRequest(`http://localhost:3000/api/community/${id}/vote`, {
    method: "DELETE",
  });
}

describe("POST /api/community/:id/vote", () => {
  it("casts 'keep' vote successfully", async () => {
    // Item 2: requested by plex-user-1 who voted "delete" -> plex-user-2 can community vote
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createVoteRequest("2", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "2" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("keep");
  });

  it("casts 'remove' vote successfully", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const req = createVoteRequest("5", "remove");
    const res = await POST(req, { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("remove");
  });

  it("updates existing vote (upsert)", async () => {
    // plex-user-2 already voted 'remove' on item 2, change to 'keep'
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createVoteRequest("2", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "2" }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.vote).toBe("keep");
  });

  it("rejects vote on non-nominated item", async () => {
    // Item 1 has a "keep" vote from requestor, not "delete"
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createVoteRequest("1", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(404);
  });

  it("rejects vote on own item", async () => {
    // Item 2 is requested by plex-user-1 — they can't community-vote on it
    mockRequireAuth.mockResolvedValue(requestor);
    const req = createVoteRequest("2", "remove");
    const res = await POST(req, { params: Promise.resolve({ id: "2" }) });

    expect(res.status).toBe(404);
  });

  it("can community-vote on trim candidate", async () => {
    // Item 7 is "Big Brother" - requested by plex-user-1 who voted "trim" -> plex-user-2 can community vote
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createVoteRequest("7", "remove");
    const res = await POST(req, { params: Promise.resolve({ id: "7" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.vote).toBe("remove");
  });

  it("rejects invalid vote value (400)", async () => {
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createVoteRequest("2", "delete");
    const res = await POST(req, { params: Promise.resolve({ id: "2" }) });

    expect(res.status).toBe(400);
  });

  it("rejects invalid media ID (400)", async () => {
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createVoteRequest("abc", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createVoteRequest("2", "keep");
    const res = await POST(req, { params: Promise.resolve({ id: "2" }) });

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/community/:id/vote", () => {
  it("retracts vote successfully", async () => {
    // plex-user-2 has a community vote on item 2
    mockRequireAuth.mockResolvedValue(otherUser);
    const req = createDeleteRequest("2");
    const res = await DELETE(req, { params: Promise.resolve({ id: "2" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("succeeds even if no vote exists", async () => {
    mockRequireAuth.mockResolvedValue(adminUser);
    const req = createDeleteRequest("5");
    const res = await DELETE(req, { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(200);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createDeleteRequest("2");
    const res = await DELETE(req, { params: Promise.resolve({ id: "2" }) });

    expect(res.status).toBe(401);
  });
});

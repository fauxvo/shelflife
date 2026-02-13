import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestData } from "@/test/helpers/db";
import { createRequest } from "@/test/helpers/request";
import { NextResponse } from "next/server";

const mockRequireAdmin = vi.fn();

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
  requireAuth: vi.fn(),
  requireAdmin: () => mockRequireAdmin(),
  handleAuthError: (error: unknown) => handleAuthError(error),
  AuthError,
}));

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  get sqlite() {
    return (testDb.db as any).session.client;
  },
}));

const { GET } = await import("../route");

const adminSession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };

function createActiveRound(): number {
  const sqlite = (testDb.db as any).session.client;
  const result = sqlite
    .prepare(
      `INSERT INTO review_rounds (name, status, created_by_plex_id) VALUES ('Test Round', 'active', 'plex-admin') RETURNING id`
    )
    .get() as { id: number };
  return result.id;
}

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAdmin.mockReset();
});

describe("GET /api/admin/review-rounds/:id/completion", () => {
  it("returns correct participant count (all non-admin users)", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const roundId = createActiveRound();

    const req = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${roundId}/completion`
    );
    const res = await GET(req, { params: Promise.resolve({ id: String(roundId) }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    // Seed data has: plex-user-1 and plex-user-2 (non-admin)
    // plex-admin is excluded because is_admin = true
    expect(data.totalParticipants).toBe(2);
    expect(data.users).toHaveLength(2);
    // plexId should not be exposed in the response
    expect(data.users[0]).not.toHaveProperty("plexId");
    expect(data.users[0]).toHaveProperty("username");
  });

  it("returns 0/0 when no statuses set", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const roundId = createActiveRound();

    const req = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${roundId}/completion`
    );
    const res = await GET(req, { params: Promise.resolve({ id: String(roundId) }) });
    const data = await res.json();

    expect(data.nominationsComplete).toBe(0);
    expect(data.votingComplete).toBe(0);
  });

  it("returns correct counts after users toggle", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const roundId = createActiveRound();
    const sqlite = (testDb.db as any).session.client;

    // User 1 completes nominations
    sqlite.exec(
      `INSERT INTO user_review_statuses (review_round_id, user_plex_id, nominations_complete, voting_complete) VALUES (${roundId}, 'plex-user-1', 1, 0)`
    );

    // User 2 completes both
    sqlite.exec(
      `INSERT INTO user_review_statuses (review_round_id, user_plex_id, nominations_complete, voting_complete) VALUES (${roundId}, 'plex-user-2', 1, 1)`
    );

    const req = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${roundId}/completion`
    );
    const res = await GET(req, { params: Promise.resolve({ id: String(roundId) }) });
    const data = await res.json();

    expect(data.nominationsComplete).toBe(2);
    expect(data.votingComplete).toBe(1);
    expect(data.totalParticipants).toBe(2);
  });

  it("returns 404 for non-existent round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/999/completion");
    const res = await GET(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid round ID", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/abc/completion");
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(400);
  });

  it("returns 403 without admin auth", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/completion");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(403);
  });
});

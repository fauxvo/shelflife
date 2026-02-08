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
}));

const { GET } = await import("../route");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAdmin.mockReset();
});

const adminSession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };

describe("GET /api/admin/users/:plexId/requests", () => {
  it("returns the specified user's items with votes and watch status", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/users/plex-user-1/requests");
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items.length).toBe(6);
  });

  it("includes vote data in response", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/users/plex-user-1/requests");
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    const item1 = data.items.find((i: any) => i.id === 1);
    expect(item1.vote).toBeNull();

    const item2 = data.items.find((i: any) => i.id === 2);
    expect(item2.vote).toBe("delete");
  });

  it("filters by vote=nominated", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?vote=nominated"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.items.length).toBe(2);
    expect(data.items.every((i: any) => i.vote === "delete" || i.vote === "trim")).toBe(true);
  });

  it("filters by vote=delete", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?vote=delete"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].vote).toBe("delete");
  });

  it("filters by vote=none (no vote)", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?vote=none"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.items.length).toBe(4);
    expect(data.items.every((i: any) => i.vote === null)).toBe(true);
  });

  it("filters by watched=true", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?watched=true"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].id).toBe(1);
  });

  it("returns pagination metadata", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?limit=2&page=1"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(2);
    expect(data.pagination.total).toBe(6);
    expect(data.pagination.pages).toBe(3);
  });

  it("paginates page 2", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?limit=2&page=2"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.items.length).toBe(2);
    expect(data.pagination.page).toBe(2);
  });

  it("pagination total reflects vote filter", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?vote=nominated"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    // 2 items have nominations (delete/trim), total should be 2
    expect(data.pagination.total).toBe(2);
    expect(data.pagination.pages).toBe(1);
  });

  it("pagination total reflects watched filter", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest(
      "http://localhost:3000/api/admin/users/plex-user-1/requests?watched=true"
    );
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    expect(data.pagination.total).toBe(1);
    expect(data.pagination.pages).toBe(1);
  });

  it("includes adminVote field when admin has voted", async () => {
    // Admin votes on item 1 (belongs to plex-user-1)
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(
      `INSERT INTO user_votes (media_item_id, user_plex_id, vote) VALUES (1, 'plex-admin', 'delete')`
    );

    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/users/plex-user-1/requests");
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    const item1 = data.items.find((i: any) => i.id === 1);
    expect(item1.vote).toBeNull(); // user has no vote on item 1
    expect(item1.adminVote).toBe("delete"); // admin's vote
  });

  it("returns adminVote as null when admin has not voted", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/users/plex-user-1/requests");
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });
    const data = await res.json();

    const item1 = data.items.find((i: any) => i.id === 1);
    expect(item1.adminVote).toBeNull();
    expect(item1.adminKeepSeasons).toBeNull();
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));
    const req = createRequest("http://localhost:3000/api/admin/users/plex-user-1/requests");
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createRequest("http://localhost:3000/api/admin/users/plex-user-1/requests");
    const res = await GET(req, { params: Promise.resolve({ plexId: "plex-user-1" }) });

    expect(res.status).toBe(401);
  });
});

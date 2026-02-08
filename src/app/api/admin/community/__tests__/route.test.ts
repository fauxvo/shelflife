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

describe("GET /api/admin/community", () => {
  it("returns community candidates with tallies", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items.length).toBe(3);
  });

  it("includes voter breakdown per item", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community");
    const res = await GET(req);
    const data = await res.json();

    const item2 = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(item2.voters).toBeDefined();
    expect(item2.voters.length).toBe(2);

    const voterNames = item2.voters.map((v: any) => v.username);
    expect(voterNames).toContain("otheruser");
    expect(voterNames).toContain("adminuser");
  });

  it("includes vote value in voter breakdown", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community");
    const res = await GET(req);
    const data = await res.json();

    const item2 = data.items.find((i: any) => i.title === "Test Movie 2");
    const otherVoter = item2.voters.find((v: any) => v.username === "otheruser");
    expect(otherVoter.vote).toBe("remove");

    const adminVoter = item2.voters.find((v: any) => v.username === "adminuser");
    expect(adminVoter.vote).toBe("keep");
  });

  it("returns correct tallies", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community");
    const res = await GET(req);
    const data = await res.json();

    const item2 = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(item2.tally.keepCount).toBe(1);
    expect(item2.tally.removeCount).toBe(1);
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));
    const req = createRequest("http://localhost:3000/api/admin/community");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("sorts by title_asc when sort param is provided", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community?sort=title_asc");
    const res = await GET(req);
    const data = await res.json();

    const titles = data.items.map((i: any) => i.title);
    const sorted = [...titles].sort((a: string, b: string) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });

  it("sorts by requested_newest", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community?sort=requested_newest");
    const res = await GET(req);
    const data = await res.json();

    const dates = data.items.map((i: any) => i.requestedAt);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });

  it("includes removed items in admin listing with status badge", async () => {
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 2`);

    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community");
    const res = await GET(req);
    const data = await res.json();

    const removedItem = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(removedItem).toBeDefined();
    expect(removedItem.status).toBe("removed");
    expect(data.items.length).toBe(3);
    expect(data.pagination.total).toBe(3);
  });

  it("handles pagination", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/community?page=1&limit=1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.pages).toBe(3);
  });
});

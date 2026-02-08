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

const { GET } = await import("../route");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAuth.mockReset();
});

const userSession = { userId: 2, plexId: "plex-user-2", username: "otheruser", isAdmin: false };
const adminSession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };

describe("GET /api/community", () => {
  it("returns items where requestor voted 'delete' or 'trim', including own", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Items 2 (delete by user-1), 5 (delete by user-2, own), 7 (trim by user-1)
    expect(data.items.length).toBe(3);
    const titles = data.items.map((i: any) => i.title);
    expect(titles).toContain("Test Movie 2");
    expect(titles).toContain("Big Brother");
    expect(titles).toContain("Other Movie");
  });

  it("returns correct vote tallies", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    // Item 2 has community votes: plex-user-2 'remove', plex-admin 'keep'
    const item2 = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(item2.tally.keepCount).toBe(1);
    expect(item2.tally.removeCount).toBe(1);
  });

  it("returns current user's community vote", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    // plex-user-2 voted 'remove' on item 2
    const item2 = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(item2.currentUserVote).toBe("remove");
  });

  it("does not return voter identities", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    for (const item of data.items) {
      expect(item.voters).toBeUndefined();
    }
  });

  it("filters by type=movie", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community?type=movie");
    const res = await GET(req);
    const data = await res.json();

    // user-2 sees item 2 (movie, by user-1) + item 5 (movie, own)
    expect(data.items.length).toBe(2);
    for (const item of data.items) {
      expect(item.mediaType).toBe("movie");
    }
  });

  it("filters by type=tv returns trim candidates", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community?type=tv");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toBe("Big Brother");
    expect(data.items[0].nominationType).toBe("trim");
  });

  it("filters by unvoted=true", async () => {
    mockRequireAuth.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/community?unvoted=true");
    const res = await GET(req);
    const data = await res.json();

    // admin voted 'keep' on item 2, but not on item 5 or 7
    const titles = data.items.map((i: any) => i.title);
    expect(titles).toContain("Other Movie");
    expect(titles).toContain("Big Brother");
    expect(titles).not.toContain("Test Movie 2");
  });

  it("sorts by most_remove (default)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community?sort=most_remove");
    const res = await GET(req);
    const data = await res.json();

    // 3 candidates total (2 delete + 1 trim), including own
    expect(data.items.length).toBe(3);
  });

  it("handles pagination", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community?page=1&limit=1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.pages).toBe(3);
  });

  it("returns pagination metadata", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.total).toBeGreaterThan(0);
  });

  it("sorts by title_asc (alphabetical)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community?sort=title_asc");
    const res = await GET(req);
    const data = await res.json();

    const titles = data.items.map((i: any) => i.title);
    const sorted = [...titles].sort((a: string, b: string) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });

  it("sorts by requested_newest", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community?sort=requested_newest");
    const res = await GET(req);
    const data = await res.json();

    const dates = data.items.map((i: any) => i.requestedAt);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns trim candidates with seasonCount and keepSeasons", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    const trimItem = data.items.find((i: any) => i.title === "Big Brother");
    expect(trimItem).toBeDefined();
    expect(trimItem.nominationType).toBe("trim");
    expect(trimItem.seasonCount).toBe(8);
    expect(trimItem.keepSeasons).toBe(1);
  });

  it("marks own items with isOwn flag", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    // Item 5 is user-2's own nomination
    const ownItem = data.items.find((i: any) => i.title === "Other Movie");
    expect(ownItem.isOwn).toBe(true);

    // Item 2 is user-1's nomination — not own for user-2
    const otherItem = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(otherItem.isOwn).toBe(false);
  });

  it("returns correct nominationType for delete candidates", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    const deleteItem = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(deleteItem).toBeDefined();
    expect(deleteItem.nominationType).toBe("delete");
    expect(deleteItem.keepSeasons).toBeNull();
  });

  it("includes removed items in community listing with status badge", async () => {
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 2`);

    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/community");
    const res = await GET(req);
    const data = await res.json();

    const removedItem = data.items.find((i: any) => i.title === "Test Movie 2");
    expect(removedItem).toBeDefined();
    expect(removedItem.status).toBe("removed");
    // All candidates should still be present
    expect(data.items.length).toBe(3);
    expect(data.pagination.total).toBe(3);
  });
});

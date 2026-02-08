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

const userSession = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };
const otherSession = { userId: 2, plexId: "plex-user-2", username: "otheruser", isAdmin: false };

describe("GET /api/media", () => {
  it("returns user's own media items", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items.length).toBe(6);
    expect(data.items.every((i: any) => i.id !== 5)).toBe(true);
  });

  it("does not return other users' items", async () => {
    mockRequireAuth.mockResolvedValue(otherSession);
    const req = createRequest("http://localhost:3000/api/media");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].id).toBe(5);
  });

  it("filters by type=movie", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?type=movie");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.every((i: any) => i.mediaType === "movie")).toBe(true);
    expect(data.items.length).toBe(3);
  });

  it("filters by type=tv", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?type=tv");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.every((i: any) => i.mediaType === "tv")).toBe(true);
    expect(data.items.length).toBe(3);
  });

  it("filters by status=available", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?status=available");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.every((i: any) => i.status === "available")).toBe(true);
  });

  it("filters by status=pending", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?status=pending");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toBe("Test Show 2");
  });

  it("filters by vote=keep", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?vote=keep");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.every((i: any) => i.vote === "keep")).toBe(true);
    expect(data.items.length).toBe(1);
  });

  it("filters by vote=delete", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?vote=delete");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.every((i: any) => i.vote === "delete")).toBe(true);
    expect(data.items.length).toBe(1);
  });

  it("filters by vote=none (no vote cast)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?vote=none");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.every((i: any) => i.vote === null)).toBe(true);
    expect(data.items.length).toBe(3);
  });

  it("filters by watched=true", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?watched=true");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].id).toBe(1);
  });

  it("combines type + vote filters", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?type=movie&vote=keep");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].mediaType).toBe("movie");
    expect(data.items[0].vote).toBe("keep");
  });

  it("returns pagination metadata", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?limit=2&page=1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(2);
    expect(data.pagination.total).toBe(6);
    expect(data.pagination.pages).toBe(3);
  });

  it("paginates correctly - page 2", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?limit=2&page=2");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(2);
    expect(data.pagination.page).toBe(2);
  });

  it("includes vote and watchStatus in response", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media");
    const res = await GET(req);
    const data = await res.json();

    const item1 = data.items.find((i: any) => i.id === 1);
    expect(item1.vote).toBe("keep");
    expect(item1.watchStatus).toEqual({
      watched: true,
      playCount: 3,
      lastWatchedAt: "2024-06-01T00:00:00Z",
    });

    const item4 = data.items.find((i: any) => i.id === 4);
    expect(item4.vote).toBeNull();
    expect(item4.watchStatus).toBeNull();
  });

  it("pagination total reflects vote filter", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?vote=keep");
    const res = await GET(req);
    const data = await res.json();

    // Only 1 item has "keep" vote, so total should be 1, not 5
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.pages).toBe(1);
    expect(data.items.length).toBe(1);
  });

  it("pagination total reflects watched filter", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?watched=true");
    const res = await GET(req);
    const data = await res.json();

    // Only 1 item has watched=true, total should be 1
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.pages).toBe(1);
  });

  it("pagination total reflects combined filters", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?type=movie&vote=none");
    const res = await GET(req);
    const data = await res.json();

    // Movies with no vote for plex-user-1: item 6 (Another Movie)
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.pages).toBe(1);
  });

  it("filters by search term", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?search=Big");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toBe("Big Brother");
  });

  it("returns empty when search has no matches", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?search=nonexistent");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(0);
    expect(data.pagination.total).toBe(0);
  });

  it("excludes removed items by default", async () => {
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 1`);

    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.find((i: any) => i.id === 1)).toBeUndefined();
    expect(data.items.length).toBe(5);
  });

  it("includes removed items when status=removed is explicit", async () => {
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 1`);

    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?status=removed");
    const res = await GET(req);
    const data = await res.json();

    expect(data.items.length).toBe(1);
    expect(data.items[0].id).toBe(1);
    expect(data.items[0].status).toBe("removed");
  });

  it("sorts by title_desc (Z-A)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?sort=title_desc");
    const res = await GET(req);
    const data = await res.json();

    const titles = data.items.map((i: any) => i.title);
    const sorted = [...titles].sort((a: string, b: string) => b.localeCompare(a));
    expect(titles).toEqual(sorted);
  });

  it("sorts by requested_newest", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?sort=requested_newest");
    const res = await GET(req);
    const data = await res.json();

    const dates = data.items.map((i: any) => i.requestedAt);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });

  it("sorts by requested_oldest", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media?sort=requested_oldest");
    const res = await GET(req);
    const data = await res.json();

    const dates = data.items.map((i: any) => i.requestedAt);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] <= dates[i + 1]).toBe(true);
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createRequest("http://localhost:3000/api/media");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

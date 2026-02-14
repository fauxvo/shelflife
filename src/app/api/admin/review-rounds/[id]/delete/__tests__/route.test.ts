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

vi.mock("@/lib/services/deletion", () => ({
  executeMediaDeletion: vi.fn(),
}));

const { POST } = await import("../route");
const { executeMediaDeletion } = await import("@/lib/services/deletion");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAdmin.mockReset();
  vi.mocked(executeMediaDeletion).mockReset();
});

const adminSession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };

describe("POST /api/admin/review-rounds/:id/delete", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Unauthorized", 401));

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid round ID", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/abc/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid round ID");
  });

  it("returns 400 for invalid body", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/delete", {
      method: "POST",
      body: { deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("returns 404 for non-existent round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/999/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Review round not found");
  });

  it("returns 400 for closed round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const sqlite = (testDb.db as any).session.client;

    // Create a round and close it
    sqlite.exec(
      `INSERT INTO review_rounds (id, name, status, created_by_plex_id) VALUES (1, 'Test Round', 'closed', 'plex-admin')`
    );

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Review round is not active");
  });

  it("returns 400 when no remove action exists", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const sqlite = (testDb.db as any).session.client;

    // Create an active round but don't add any review action
    sqlite.exec(
      `INSERT INTO review_rounds (id, name, status, created_by_plex_id) VALUES (1, 'Test Round', 'active', 'plex-admin')`
    );

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("No remove action found for this media item in this round");
  });

  it("returns 400 when media item already removed", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const sqlite = (testDb.db as any).session.client;

    // Set media item 1 status to "removed"
    sqlite.exec(`UPDATE media_items SET status = 'removed' WHERE id = 1`);

    // Create active round with remove action for item 1
    sqlite.exec(
      `INSERT INTO review_rounds (id, name, status, created_by_plex_id) VALUES (1, 'Test Round', 'active', 'plex-admin')`
    );
    sqlite.exec(
      `INSERT INTO review_actions (review_round_id, media_item_id, action, acted_by_plex_id) VALUES (1, 1, 'remove', 'plex-admin')`
    );

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: false },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Media item has already been removed");
  });

  it("returns 200 and calls executeMediaDeletion on success", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const sqlite = (testDb.db as any).session.client;

    // Create active round with remove action for item 1
    sqlite.exec(
      `INSERT INTO review_rounds (id, name, status, created_by_plex_id) VALUES (1, 'Test Round', 'active', 'plex-admin')`
    );
    sqlite.exec(
      `INSERT INTO review_actions (review_round_id, media_item_id, action, acted_by_plex_id) VALUES (1, 1, 'remove', 'plex-admin')`
    );

    const mockResult = {
      mediaItemId: 1,
      sonarr: { attempted: false, success: null },
      radarr: { attempted: true, success: true },
      overseerr: { attempted: true, success: true },
    };
    vi.mocked(executeMediaDeletion).mockResolvedValue(mockResult);

    const req = createRequest("http://localhost:3000/api/admin/review-rounds/1/delete", {
      method: "POST",
      body: { mediaItemId: 1, deleteFiles: true },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(executeMediaDeletion).toHaveBeenCalledWith({
      mediaItemId: 1,
      deleteFiles: true,
      deletedByPlexId: "plex-admin",
      reviewRoundId: 1,
    });
  });
});

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

const routeModule = await import("../route");
const { GET, POST } = routeModule;

const roundDetailModule = await import("@/app/api/admin/review-rounds/[id]/route");
const actionModule = await import("@/app/api/admin/review-rounds/[id]/action/route");
const closeModule = await import("@/app/api/admin/review-rounds/[id]/close/route");

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAdmin.mockReset();
});

const adminSession = { userId: 3, plexId: "plex-admin", username: "adminuser", isAdmin: true };

describe("POST /api/admin/review-rounds", () => {
  it("creates a review round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "February 2024 Review" },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.round.name).toBe("February 2024 Review");
    expect(data.round.status).toBe("active");
  });

  it("rejects creating second active round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Create first round
    const req1 = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Round 1" },
    });
    await POST(req1);

    // Try creating second
    const req2 = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Round 2" },
    });
    const res2 = await POST(req2);

    expect(res2.status).toBe(409);
  });

  it("rejects empty name", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "" },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));
    const req = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "My Round" },
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/review-rounds", () => {
  it("lists rounds", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Create a round first
    const createReq = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Test Round" },
    });
    await POST(createReq);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rounds.length).toBe(1);
    expect(data.rounds[0].name).toBe("Test Round");
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));
    const res = await GET();

    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/review-rounds/:id/action", () => {
  it("records action on item", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Create round
    const createReq = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Action Round" },
    });
    const createRes = await POST(createReq);
    const { round } = await createRes.json();

    // Record action
    const actionReq = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${round.id}/action`,
      {
        method: "POST",
        body: { mediaItemId: 2, action: "remove" },
      }
    );
    const res = await actionModule.POST(actionReq, {
      params: Promise.resolve({ id: String(round.id) }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe("remove");
  });

  it("updates existing action", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Create round
    const createReq = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Update Round" },
    });
    const createRes = await POST(createReq);
    const { round } = await createRes.json();

    // Record first action
    const actionReq1 = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${round.id}/action`,
      {
        method: "POST",
        body: { mediaItemId: 2, action: "remove" },
      }
    );
    await actionModule.POST(actionReq1, {
      params: Promise.resolve({ id: String(round.id) }),
    });

    // Update action
    const actionReq2 = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${round.id}/action`,
      {
        method: "POST",
        body: { mediaItemId: 2, action: "keep" },
      }
    );
    const res = await actionModule.POST(actionReq2, {
      params: Promise.resolve({ id: String(round.id) }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.action).toBe("keep");
  });
});

describe("GET /api/admin/review-rounds/:id (candidates)", () => {
  it("includes admin-nominated items as candidates", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Admin nominates item 6 (belongs to plex-user-1) for deletion
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(
      `INSERT INTO user_votes (media_item_id, user_plex_id, vote) VALUES (6, 'plex-admin', 'delete')`
    );

    // Create a review round
    const createReq = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Admin Nomination Round" },
    });
    const createRes = await POST(createReq);
    const { round } = await createRes.json();

    // Get candidates
    const req = createRequest(`http://localhost:3000/api/admin/review-rounds/${round.id}`);
    const res = await roundDetailModule.GET(req, {
      params: Promise.resolve({ id: String(round.id) }),
    });
    const data = await res.json();

    const titles = data.candidates.map((c: any) => c.title);
    expect(titles).toContain("Another Movie");
  });

  it("does not duplicate candidates when both self and admin nominate", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Admin also votes delete on item 2 (already self-nominated by plex-user-1)
    const sqlite = (testDb.db as any).session.client;
    sqlite.exec(
      `INSERT INTO user_votes (media_item_id, user_plex_id, vote) VALUES (2, 'plex-admin', 'delete')`
    );

    // Create a review round
    const createReq = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Dedup Round" },
    });
    const createRes = await POST(createReq);
    const { round } = await createRes.json();

    // Get candidates
    const req = createRequest(`http://localhost:3000/api/admin/review-rounds/${round.id}`);
    const res = await roundDetailModule.GET(req, {
      params: Promise.resolve({ id: String(round.id) }),
    });
    const data = await res.json();

    const item2Entries = data.candidates.filter((c: any) => c.title === "Test Movie 2");
    expect(item2Entries.length).toBe(1);
  });
});

describe("POST /api/admin/review-rounds/:id/close", () => {
  it("closes round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Create round
    const createReq = createRequest("http://localhost:3000/api/admin/review-rounds", {
      method: "POST",
      body: { name: "Close Round" },
    });
    const createRes = await POST(createReq);
    const { round } = await createRes.json();

    // Close it
    const closeReq = createRequest(
      `http://localhost:3000/api/admin/review-rounds/${round.id}/close`,
      { method: "POST" }
    );
    const res = await closeModule.POST(closeReq, {
      params: Promise.resolve({ id: String(round.id) }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("rejects closing non-existent round", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const closeReq = createRequest("http://localhost:3000/api/admin/review-rounds/999/close", {
      method: "POST",
    });
    const res = await closeModule.POST(closeReq, {
      params: Promise.resolve({ id: "999" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));
    const closeReq = createRequest("http://localhost:3000/api/admin/review-rounds/1/close", {
      method: "POST",
    });
    const res = await closeModule.POST(closeReq, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(res.status).toBe(403);
  });
});

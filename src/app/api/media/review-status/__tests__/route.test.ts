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
  get sqlite() {
    return (testDb.db as any).session.client;
  },
}));

const { GET, POST } = await import("../route");

const userSession = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };

function createActiveRound() {
  const sqlite = (testDb.db as any).session.client;
  sqlite.exec(
    `INSERT INTO review_rounds (name, status, created_by_plex_id) VALUES ('Test Round', 'active', 'plex-admin')`
  );
}

beforeEach(() => {
  testDb = createTestDb();
  seedTestData(testDb.db);
  mockRequireAuth.mockReset();
});

describe("GET /api/media/review-status", () => {
  it("returns null when no active round", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeRound).toBeNull();
    expect(data.status).toBeNull();
  });

  it("returns defaults (false/false) when active round exists but no row yet", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeRound).not.toBeNull();
    expect(data.activeRound.name).toBe("Test Round");
    expect(data.status.nominationsComplete).toBe(false);
    expect(data.status.votingComplete).toBe(false);
  });

  it("returns 401 without auth", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));
    const res = await GET();

    expect(res.status).toBe(401);
  });
});

describe("POST /api/media/review-status", () => {
  it("toggles nominations_complete on", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    const req = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete", value: true },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.field).toBe("nominations_complete");
    expect(data.value).toBe(true);
  });

  it("toggles voting_complete on", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    const req = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "voting_complete", value: true },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.field).toBe("voting_complete");
    expect(data.value).toBe(true);
  });

  it("toggles nominations_complete off (undo)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    // Toggle on first
    const onReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete", value: true },
    });
    await POST(onReq);

    // Toggle off
    const offReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete", value: false },
    });
    const res = await POST(offReq);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.value).toBe(false);
  });

  it("toggles voting_complete off (undo)", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    // Toggle on first
    const onReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "voting_complete", value: true },
    });
    await POST(onReq);

    // Toggle off
    const offReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "voting_complete", value: false },
    });
    const res = await POST(offReq);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.value).toBe(false);
  });

  it("GET reflects toggled state after POST", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    // Toggle nominations on
    const postReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete", value: true },
    });
    await POST(postReq);

    // Verify via GET
    const res = await GET();
    const data = await res.json();

    expect(data.status.nominationsComplete).toBe(true);
    expect(data.status.votingComplete).toBe(false);
  });

  it("GET reflects undo after toggle on then off", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    // Toggle on
    const onReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "voting_complete", value: true },
    });
    await POST(onReq);

    // Verify on via GET
    let res = await GET();
    let data = await res.json();
    expect(data.status.votingComplete).toBe(true);

    // Toggle off
    const offReq = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "voting_complete", value: false },
    });
    await POST(offReq);

    // Verify off via GET
    res = await GET();
    data = await res.json();
    expect(data.status.votingComplete).toBe(false);
  });

  it("returns 400 with malformed JSON body", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    const req = new (await import("next/server")).NextRequest(
      new URL("http://localhost:3000/api/media/review-status"),
      {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 404 when no active round", async () => {
    mockRequireAuth.mockResolvedValue(userSession);

    const req = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete", value: true },
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 400 with invalid body", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    const req = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "invalid_field", value: true },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with missing value", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    createActiveRound();

    const req = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete" },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Not authenticated", 401));

    const req = createRequest("http://localhost:3000/api/media/review-status", {
      method: "POST",
      body: { field: "nominations_complete", value: true },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});

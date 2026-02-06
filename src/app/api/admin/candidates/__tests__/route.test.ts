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

describe("GET /api/admin/candidates", () => {
  it("returns items where requestor voted 'delete'", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/candidates");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.candidates.length).toBe(2);
    expect(data.candidates.every((c: any) => c.vote === "delete")).toBe(true);
  });

  it("does NOT return items voted 'keep'", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/candidates");
    const res = await GET(req);
    const data = await res.json();

    const keepItem = data.candidates.find((c: any) => c.id === 1);
    expect(keepItem).toBeUndefined();
  });

  it("includes requester username", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/candidates");
    const res = await GET(req);
    const data = await res.json();

    const item2 = data.candidates.find((c: any) => c.id === 2);
    expect(item2.requestedByUsername).toBe("testuser");
  });

  it("includes watch status info", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/candidates");
    const res = await GET(req);
    const data = await res.json();

    const item5 = data.candidates.find((c: any) => c.id === 5);
    expect(item5.watched).toBe(true);
    expect(item5.playCount).toBe(2);
  });

  it("returns pagination metadata", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/candidates?limit=1&page=1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.pagination.total).toBe(2);
    expect(data.pagination.pages).toBe(2);
    expect(data.candidates.length).toBe(1);
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Admin access required", 403));
    const req = createRequest("http://localhost:3000/api/admin/candidates");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Not authenticated", 401));
    const req = createRequest("http://localhost:3000/api/admin/candidates");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

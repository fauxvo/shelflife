import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";
import { createRequest } from "@/test/helpers/request";
import { NextResponse } from "next/server";
import { appSettings } from "@/lib/db/schema";

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

// Mock cron to prevent actual scheduling
vi.mock("@/lib/services/cron", () => ({
  rescheduleSync: vi.fn(),
}));

const { GET, PUT } = await import("../route");

const adminSession = { userId: 1, plexId: "plex-admin", username: "admin", isAdmin: true };

beforeEach(() => {
  testDb = createTestDb();
  mockRequireAdmin.mockReset();
});

describe("GET /api/admin/settings/sync-schedule", () => {
  it("returns default settings when none exist", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      enabled: false,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
  });

  it("returns stored settings", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    await testDb.db.insert(appSettings).values([
      { key: "sync_schedule_enabled", value: "true" },
      { key: "sync_schedule_cron", value: "0 0 * * *" },
      { key: "sync_schedule_type", value: "overseerr" },
    ]);

    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      enabled: true,
      schedule: "0 0 * * *",
      syncType: "overseerr",
    });
  });

  it("rejects non-admin users", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Forbidden", 403));
    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/admin/settings/sync-schedule", () => {
  it("saves valid settings", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule", {
      method: "PUT",
      body: { enabled: true, schedule: "0 */12 * * *", syncType: "full" },
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      enabled: true,
      schedule: "0 */12 * * *",
      syncType: "full",
    });
  });

  it("rejects invalid cron expressions", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule", {
      method: "PUT",
      body: { enabled: true, schedule: "not a cron", syncType: "full" },
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid cron expression");
  });

  it("rejects invalid sync type with validation error", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule", {
      method: "PUT",
      body: { enabled: true, schedule: "0 0 * * *", syncType: "invalid" },
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it("rejects non-admin users", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Forbidden", 403));

    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule", {
      method: "PUT",
      body: { enabled: true, schedule: "0 0 * * *", syncType: "full" },
    });
    const res = await PUT(req);

    expect(res.status).toBe(403);
  });

  it("calls rescheduleSync after saving", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);
    const { rescheduleSync } = await import("@/lib/services/cron");

    const req = createRequest("http://localhost:3000/api/admin/settings/sync-schedule", {
      method: "PUT",
      body: { enabled: true, schedule: "0 */12 * * *", syncType: "full" },
    });
    await PUT(req);

    expect(rescheduleSync).toHaveBeenCalled();
  });

  it("persists settings across reads", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Write
    const putReq = createRequest("http://localhost:3000/api/admin/settings/sync-schedule", {
      method: "PUT",
      body: { enabled: true, schedule: "0 0 * * 0", syncType: "tautulli" },
    });
    await PUT(putReq);

    // Read back
    const getReq = createRequest("http://localhost:3000/api/admin/settings/sync-schedule");
    const res = await GET(getReq);
    const data = await res.json();

    expect(data).toEqual({
      enabled: true,
      schedule: "0 0 * * 0",
      syncType: "tautulli",
    });
  });
});

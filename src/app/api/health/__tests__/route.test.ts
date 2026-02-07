import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET } = await import("../route");

describe("GET /api/health", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("returns 200 with status 'ok' when DB is accessible", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });

  it("returns 503 with status 'error' when DB fails", async () => {
    // Close the underlying SQLite connection to simulate DB failure
    testDb.sqlite.close();
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.timestamp).toBeDefined();
  });
});

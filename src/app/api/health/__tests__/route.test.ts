import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    run: vi.fn(),
  },
}));

import { db } from "@/lib/db";
const mockRun = vi.mocked(db.run);

const { GET } = await import("../route");

describe("GET /api/health", () => {
  it("returns 200 with status 'ok' when DB is accessible", async () => {
    mockRun.mockResolvedValueOnce(undefined as any);
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });

  it("returns 503 with status 'error' when DB fails", async () => {
    mockRun.mockRejectedValueOnce(new Error("DB connection failed"));
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.timestamp).toBeDefined();
  });
});

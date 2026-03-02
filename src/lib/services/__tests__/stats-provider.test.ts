import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { getActiveStatsProvider, setActiveStatsProvider, getClientGeneration } =
  await import("../service-config");

beforeEach(() => {
  testDb = createTestDb();
});

describe("getActiveStatsProvider / setActiveStatsProvider", () => {
  it("defaults to 'auto' when no setting exists", async () => {
    const provider = await getActiveStatsProvider();
    expect(provider).toBe("auto");
  });

  it("saves and retrieves provider setting", async () => {
    await setActiveStatsProvider("tracearr");
    const provider = await getActiveStatsProvider();
    expect(provider).toBe("tracearr");
  });

  it("overwrites previous setting", async () => {
    await setActiveStatsProvider("tautulli");
    await setActiveStatsProvider("tracearr");
    const provider = await getActiveStatsProvider();
    expect(provider).toBe("tracearr");
  });

  it("increments client generation on set", async () => {
    const before = getClientGeneration();
    await setActiveStatsProvider("tautulli");
    expect(getClientGeneration()).toBe(before + 1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";
import { appSettings } from "@/lib/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

// Mock the cron module to prevent actual scheduling
vi.mock("@/lib/services/cron", () => ({
  rescheduleSync: vi.fn(),
}));

const { getSyncScheduleSettings, updateSyncScheduleSettings } = await import("../settings");

beforeEach(() => {
  testDb = createTestDb();
});

describe("getSyncScheduleSettings", () => {
  it("returns defaults when no settings exist", async () => {
    const settings = await getSyncScheduleSettings();

    expect(settings).toEqual({
      enabled: false,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
  });

  it("returns stored settings", async () => {
    await testDb.db.insert(appSettings).values([
      { key: "sync_schedule_enabled", value: "true" },
      { key: "sync_schedule_cron", value: "0 0 * * *" },
      { key: "sync_schedule_type", value: "overseerr" },
    ]);

    const settings = await getSyncScheduleSettings();

    expect(settings).toEqual({
      enabled: true,
      schedule: "0 0 * * *",
      syncType: "overseerr",
    });
  });

  it("returns defaults for missing keys", async () => {
    await testDb.db.insert(appSettings).values([{ key: "sync_schedule_enabled", value: "true" }]);

    const settings = await getSyncScheduleSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.schedule).toBe("0 */6 * * *");
    expect(settings.syncType).toBe("full");
  });

  it("falls back to default for invalid syncType in DB", async () => {
    await testDb.db
      .insert(appSettings)
      .values([{ key: "sync_schedule_type", value: "invalid_type" }]);

    const settings = await getSyncScheduleSettings();
    expect(settings.syncType).toBe("full");
  });

  it("returns enabled false for non-'true' values", async () => {
    await testDb.db.insert(appSettings).values([{ key: "sync_schedule_enabled", value: "false" }]);

    const settings = await getSyncScheduleSettings();
    expect(settings.enabled).toBe(false);
  });
});

describe("updateSyncScheduleSettings", () => {
  it("inserts new settings", async () => {
    const input = { enabled: true, schedule: "0 0 * * *", syncType: "full" as const };
    const result = await updateSyncScheduleSettings(input);

    expect(result).toEqual(input);

    const settings = await getSyncScheduleSettings();
    expect(settings).toEqual(input);
  });

  it("updates existing settings", async () => {
    await testDb.db.insert(appSettings).values([
      { key: "sync_schedule_enabled", value: "false" },
      { key: "sync_schedule_cron", value: "0 */6 * * *" },
      { key: "sync_schedule_type", value: "full" },
    ]);

    await updateSyncScheduleSettings({
      enabled: true,
      schedule: "0 */12 * * *",
      syncType: "tautulli",
    });

    const settings = await getSyncScheduleSettings();
    expect(settings).toEqual({
      enabled: true,
      schedule: "0 */12 * * *",
      syncType: "tautulli",
    });
  });

  it("calls rescheduleSync after updating", async () => {
    const { rescheduleSync } = await import("@/lib/services/cron");

    await updateSyncScheduleSettings({
      enabled: true,
      schedule: "0 0 * * *",
      syncType: "full",
    });

    expect(rescheduleSync).toHaveBeenCalled();
  });
});

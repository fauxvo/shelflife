import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSchedule = vi.fn();
const mockValidate = vi.fn();
const mockStop = vi.fn();

vi.mock("node-cron", () => ({
  default: {
    schedule: (...args: unknown[]) => {
      mockSchedule(...args);
      return { stop: mockStop };
    },
    validate: (expr: string) => mockValidate(expr),
  },
}));

const mockGetSyncScheduleSettings = vi.fn();

vi.mock("@/lib/services/settings", () => ({
  getSyncScheduleSettings: () => mockGetSyncScheduleSettings(),
}));

const mockDispatchSync = vi.fn();
const mockIsSyncInProgress = vi.fn();

vi.mock("@/lib/services/sync-dispatch", () => ({
  dispatchSync: (...args: unknown[]) => mockDispatchSync(...args),
  isSyncInProgress: () => mockIsSyncInProgress(),
}));

const { rescheduleSync, initCronScheduler } = await import("../cron");

beforeEach(() => {
  mockSchedule.mockClear();
  mockValidate.mockClear();
  mockStop.mockClear();
  mockGetSyncScheduleSettings.mockReset();
  mockDispatchSync.mockReset();
  mockIsSyncInProgress.mockReset();
  mockIsSyncInProgress.mockReturnValue(false);
});

describe("rescheduleSync", () => {
  it("schedules a task when enabled with valid cron", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: true,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
    mockValidate.mockReturnValue(true);

    await rescheduleSync();

    expect(mockValidate).toHaveBeenCalledWith("0 */6 * * *");
    expect(mockSchedule).toHaveBeenCalledWith("0 */6 * * *", expect.any(Function));
  });

  it("does not schedule when disabled", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: false,
      schedule: "0 */6 * * *",
      syncType: "full",
    });

    await rescheduleSync();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("does not schedule with invalid cron expression", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: true,
      schedule: "not valid",
      syncType: "full",
    });
    mockValidate.mockReturnValue(false);

    await rescheduleSync();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("stops existing task before creating new one", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: true,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
    mockValidate.mockReturnValue(true);

    // First call creates a task
    await rescheduleSync();
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    // Second call should stop the first task
    await rescheduleSync();
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });

  it("serializes concurrent calls", async () => {
    let resolveFirst: () => void;
    const firstCallPromise = new Promise<void>((r) => (resolveFirst = r));

    mockValidate.mockReturnValue(true);

    // First call blocks on settings read
    mockGetSyncScheduleSettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          firstCallPromise.then(() =>
            resolve({ enabled: true, schedule: "0 0 * * *", syncType: "full" })
          );
        })
    );
    // Second call resolves immediately
    mockGetSyncScheduleSettings.mockResolvedValueOnce({
      enabled: true,
      schedule: "0 */12 * * *",
      syncType: "overseerr",
    });

    const p1 = rescheduleSync();
    const p2 = rescheduleSync();

    // Unblock first call
    resolveFirst!();
    await p1;
    await p2;

    // Both should complete without leaking tasks — second call stops first task
    expect(mockStop).toHaveBeenCalled();
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });
});

describe("executeSyncJob (via scheduled callback)", () => {
  it("calls dispatchSync when no sync in progress", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: true,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
    mockValidate.mockReturnValue(true);
    mockDispatchSync.mockResolvedValue({ overseerr: 5, tautulli: 3 });

    await rescheduleSync();

    // Get the callback passed to cron.schedule and invoke it
    const callback = mockSchedule.mock.calls[mockSchedule.mock.calls.length - 1][1];
    await callback();

    expect(mockDispatchSync).toHaveBeenCalledWith("full");
  });

  it("skips when sync is already in progress", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: true,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
    mockValidate.mockReturnValue(true);
    mockIsSyncInProgress.mockReturnValue(true);

    await rescheduleSync();

    const callback = mockSchedule.mock.calls[mockSchedule.mock.calls.length - 1][1];
    await callback();

    expect(mockDispatchSync).not.toHaveBeenCalled();
  });

  it("handles dispatchSync errors gracefully", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: true,
      schedule: "0 */6 * * *",
      syncType: "full",
    });
    mockValidate.mockReturnValue(true);
    mockDispatchSync.mockRejectedValue(new Error("sync failed"));

    await rescheduleSync();

    const callback = mockSchedule.mock.calls[mockSchedule.mock.calls.length - 1][1];

    // Should not throw — executeSyncJob catches errors internally
    await callback();
    expect(mockDispatchSync).toHaveBeenCalledWith("full");
  });
});

describe("initCronScheduler", () => {
  it("calls rescheduleSync", async () => {
    mockGetSyncScheduleSettings.mockResolvedValue({
      enabled: false,
      schedule: "0 */6 * * *",
      syncType: "full",
    });

    await initCronScheduler();

    expect(mockGetSyncScheduleSettings).toHaveBeenCalled();
  });
});

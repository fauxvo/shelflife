import { describe, it, expect } from "vitest";
import { formatSyncResult } from "../SyncStatus";

describe("formatSyncResult", () => {
  it("formats full sync with both overseerr and tautulli", () => {
    expect(formatSyncResult({ overseerr: 771, tautulli: 49 })).toBe(
      "Synced 771 media items and 49 watch records"
    );
  });

  it("formats overseerr-only sync", () => {
    expect(formatSyncResult({ overseerr: 100 })).toBe("Synced 100 media items");
  });

  it("formats tautulli-only sync", () => {
    expect(formatSyncResult({ tautulli: 25 })).toBe("Synced 25 watch records");
  });

  it("handles singular media item", () => {
    expect(formatSyncResult({ overseerr: 1 })).toBe("Synced 1 media item");
  });

  it("handles singular watch record", () => {
    expect(formatSyncResult({ tautulli: 1 })).toBe("Synced 1 watch record");
  });

  it("handles zero counts", () => {
    expect(formatSyncResult({ overseerr: 0, tautulli: 0 })).toBe(
      "Synced 0 media items and 0 watch records"
    );
  });

  it("returns fallback for empty result", () => {
    expect(formatSyncResult({})).toBe("Sync complete");
  });
});

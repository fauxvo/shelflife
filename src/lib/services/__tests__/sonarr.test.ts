import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

describe("SonarrClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    process.env.SONARR_URL = "http://localhost:8989";
    process.env.SONARR_API_KEY = "test-sonarr-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SONARR_URL;
    delete process.env.SONARR_API_KEY;
  });

  it("throws if SONARR_URL is not set", async () => {
    delete process.env.SONARR_URL;
    const { getSonarrClient } = await import("../sonarr");
    expect(() => getSonarrClient()).toThrow("SONARR_URL and SONARR_API_KEY must be set");
  });

  it("throws if SONARR_API_KEY is not set", async () => {
    delete process.env.SONARR_API_KEY;
    const { getSonarrClient } = await import("../sonarr");
    expect(() => getSonarrClient()).toThrow("SONARR_URL and SONARR_API_KEY must be set");
  });

  it("lookupByTvdbId returns series when found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([{ id: 55, title: "Test Show" }]),
    });

    const { getSonarrClient } = await import("../sonarr");
    const client = getSonarrClient();
    const result = await client.lookupByTvdbId(3000);

    expect(result).toEqual({ id: 55, title: "Test Show" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8989/api/v3/series?tvdbId=3000",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Api-Key": "test-sonarr-key" }),
      })
    );
  });

  it("lookupByTvdbId returns null when not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([]),
    });

    const { getSonarrClient } = await import("../sonarr");
    const client = getSonarrClient();
    const result = await client.lookupByTvdbId(9999);

    expect(result).toBeNull();
  });

  it("deleteSeries calls correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    });

    const { getSonarrClient } = await import("../sonarr");
    const client = getSonarrClient();
    await client.deleteSeries(55, true);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8989/api/v3/series/55?deleteFiles=true&addImportListExclusion=true",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "X-Api-Key": "test-sonarr-key" }),
      })
    );
  });

  it("deleteSeries throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { getSonarrClient } = await import("../sonarr");
    const client = getSonarrClient();

    await expect(client.deleteSeries(55, true)).rejects.toThrow("Sonarr API error: 500");
  });
});

describe("isSonarrConfigured", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.SONARR_URL;
    delete process.env.SONARR_API_KEY;
  });

  it("returns true when env vars set", async () => {
    process.env.SONARR_URL = "http://localhost:8989";
    process.env.SONARR_API_KEY = "test-sonarr-key";
    const { isSonarrConfigured } = await import("../sonarr");
    expect(isSonarrConfigured()).toBe(true);
  });

  it("returns false when env vars missing", async () => {
    delete process.env.SONARR_URL;
    delete process.env.SONARR_API_KEY;
    const { isSonarrConfigured } = await import("../sonarr");
    expect(isSonarrConfigured()).toBe(false);
  });
});

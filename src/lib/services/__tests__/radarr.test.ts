import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

describe("RadarrClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    process.env.RADARR_URL = "http://localhost:7878";
    process.env.RADARR_API_KEY = "test-radarr-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RADARR_URL;
    delete process.env.RADARR_API_KEY;
  });

  it("throws if RADARR_URL is not set", async () => {
    delete process.env.RADARR_URL;
    const { getRadarrClient } = await import("../radarr");
    expect(() => getRadarrClient()).toThrow("RADARR_URL and RADARR_API_KEY must be set");
  });

  it("throws if RADARR_API_KEY is not set", async () => {
    delete process.env.RADARR_API_KEY;
    const { getRadarrClient } = await import("../radarr");
    expect(() => getRadarrClient()).toThrow("RADARR_URL and RADARR_API_KEY must be set");
  });

  it("lookupByTmdbId returns movie when found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([{ id: 42, title: "Test Movie" }]),
    });

    const { getRadarrClient } = await import("../radarr");
    const client = getRadarrClient();
    const result = await client.lookupByTmdbId(5000);

    expect(result).toEqual({ id: 42, title: "Test Movie" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:7878/api/v3/movie?tmdbId=5000",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Api-Key": "test-radarr-key" }),
      })
    );
  });

  it("lookupByTmdbId returns null when not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([]),
    });

    const { getRadarrClient } = await import("../radarr");
    const client = getRadarrClient();
    const result = await client.lookupByTmdbId(9999);

    expect(result).toBeNull();
  });

  it("deleteMovie calls correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    });

    const { getRadarrClient } = await import("../radarr");
    const client = getRadarrClient();
    await client.deleteMovie(42, true);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:7878/api/v3/movie/42?deleteFiles=true&addImportExclusion=true",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "X-Api-Key": "test-radarr-key" }),
      })
    );
  });

  it("deleteMovie throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { getRadarrClient } = await import("../radarr");
    const client = getRadarrClient();

    await expect(client.deleteMovie(42, true)).rejects.toThrow("Radarr API error: 500");
  });
});

describe("isRadarrConfigured", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.RADARR_URL;
    delete process.env.RADARR_API_KEY;
  });

  it("returns true when env vars set", async () => {
    process.env.RADARR_URL = "http://localhost:7878";
    process.env.RADARR_API_KEY = "test-radarr-key";
    const { isRadarrConfigured } = await import("../radarr");
    expect(isRadarrConfigured()).toBe(true);
  });

  it("returns false when env vars missing", async () => {
    delete process.env.RADARR_URL;
    delete process.env.RADARR_API_KEY;
    const { isRadarrConfigured } = await import("../radarr");
    expect(isRadarrConfigured()).toBe(false);
  });
});

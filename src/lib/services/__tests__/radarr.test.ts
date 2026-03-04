import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRadarrClient, extractRadarrPoster } from "../radarr";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("RadarrClient", () => {
  function makeClient() {
    return createRadarrClient({ url: "http://localhost:7878", apiKey: "test-radarr-key" });
  }

  it("lookupByTmdbId returns movie when found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([{ id: 42, title: "Test Movie" }]),
    });

    const client = makeClient();
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

    const client = makeClient();
    const result = await client.lookupByTmdbId(9999);

    expect(result).toBeNull();
  });

  it("deleteMovie calls correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    });

    const client = makeClient();
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

    const client = makeClient();

    await expect(client.deleteMovie(42, true)).rejects.toThrow("Radarr API error: 500");
  });
});

describe("extractRadarrPoster", () => {
  it("extracts relative pathname from TMDB remoteUrl", () => {
    const images = [
      { coverType: "poster", remoteUrl: "https://image.tmdb.org/t/p/original/abc123.jpg" },
    ];
    expect(extractRadarrPoster(images)).toBe("/t/p/original/abc123.jpg");
  });

  it("returns null when no poster image exists", () => {
    const images = [{ coverType: "fanart", remoteUrl: "https://example.com/fanart.jpg" }];
    expect(extractRadarrPoster(images)).toBeNull();
  });

  it("returns null when remoteUrl is missing", () => {
    const images = [{ coverType: "poster" }];
    expect(extractRadarrPoster(images)).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    const images = [{ coverType: "poster", remoteUrl: "not-a-url" }];
    expect(extractRadarrPoster(images)).toBeNull();
  });

  it("returns null for empty images array", () => {
    expect(extractRadarrPoster([])).toBeNull();
  });
});

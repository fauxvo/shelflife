import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapMediaStatus, createSeerrClient } from "../seerr";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("mapMediaStatus (seerr)", () => {
  it("maps 1 to 'unknown'", () => {
    expect(mapMediaStatus(1)).toBe("unknown");
  });

  it("maps 2 to 'pending'", () => {
    expect(mapMediaStatus(2)).toBe("pending");
  });

  it("maps 3 to 'processing'", () => {
    expect(mapMediaStatus(3)).toBe("processing");
  });

  it("maps 4 to 'partial'", () => {
    expect(mapMediaStatus(4)).toBe("partial");
  });

  it("maps 5 to 'available'", () => {
    expect(mapMediaStatus(5)).toBe("available");
  });

  it("returns 'unknown' for null", () => {
    expect(mapMediaStatus(null)).toBe("unknown");
  });

  it("returns 'unknown' for undefined", () => {
    expect(mapMediaStatus(undefined)).toBe("unknown");
  });

  it("returns 'unknown' for 0", () => {
    expect(mapMediaStatus(0)).toBe("unknown");
  });

  it("returns 'unknown' for unmapped values", () => {
    expect(mapMediaStatus(99)).toBe("unknown");
  });
});

describe("SeerrClient", () => {
  function makeClient() {
    return createSeerrClient({ url: "http://seerr:5055", apiKey: "test-key" });
  }

  it("getRequests returns parsed page with pagination", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () =>
        Promise.resolve({
          pageInfo: { pages: 1, pageSize: 20, results: 1, page: 1 },
          results: [
            {
              id: 1,
              status: 2,
              createdAt: "2024-01-01",
              updatedAt: "2024-01-02",
              type: "movie",
              media: { id: 10, tmdbId: 100, status: 5 },
              requestedBy: { id: 1, plexId: 42, plexUsername: "user1" },
            },
          ],
        }),
    });

    const client = makeClient();
    const result = await client.getRequests();
    expect(result.pageInfo.results).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].type).toBe("movie");
  });

  it("getAllRequests handles single page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () =>
        Promise.resolve({
          pageInfo: { pages: 1, pageSize: 50, results: 2, page: 1 },
          results: [
            { id: 1, status: 2, createdAt: "2024-01-01", updatedAt: "2024-01-02", type: "movie" },
            { id: 2, status: 2, createdAt: "2024-01-01", updatedAt: "2024-01-02", type: "tv" },
          ],
        }),
    });

    const client = makeClient();
    const results = await client.getAllRequests();
    expect(results).toHaveLength(2);
  });

  it("getAllRequests paginates multiple pages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () =>
        Promise.resolve({
          pageInfo: { pages: 2, pageSize: 50, results: 75, page: 1 },
          results: Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            status: 2,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            type: "movie",
          })),
        }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () =>
        Promise.resolve({
          pageInfo: { pages: 2, pageSize: 50, results: 75, page: 2 },
          results: Array.from({ length: 25 }, (_, i) => ({
            id: i + 51,
            status: 2,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            type: "tv",
          })),
        }),
    });

    const client = makeClient();
    const results = await client.getAllRequests();
    expect(results).toHaveLength(75);
  });

  it("getMediaDetails uses correct path for movie", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () =>
        Promise.resolve({
          id: 100,
          title: "Test Movie",
          posterPath: "/poster.jpg",
        }),
    });

    const client = makeClient();
    const details = await client.getMediaDetails(100, "movie");
    expect(details.title).toBe("Test Movie");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/movie/100"),
      expect.any(Object)
    );
  });

  it("getMediaDetails uses correct path for tv", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () =>
        Promise.resolve({
          id: 200,
          name: "Test Show",
        }),
    });

    const client = makeClient();
    const details = await client.getMediaDetails(200, "tv");
    expect(details.name).toBe("Test Show");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/tv/200"),
      expect.any(Object)
    );
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const client = makeClient();
    await expect(client.getRequests()).rejects.toThrow("Seerr API error: 500");
  });

  it("throws on Zod validation failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve({ totally: "wrong" }),
    });

    const client = makeClient();
    await expect(client.getRequests()).rejects.toThrow();
  });
});

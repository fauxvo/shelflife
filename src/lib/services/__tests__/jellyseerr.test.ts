import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapMediaStatus, createJellyseerrClient } from "../jellyseerr";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("mapMediaStatus (jellyseerr)", () => {
  it("maps 1 to 'unknown'", () => {
    expect(mapMediaStatus(1)).toBe("unknown");
  });

  it("maps 5 to 'available'", () => {
    expect(mapMediaStatus(5)).toBe("available");
  });

  it("returns 'unknown' for null", () => {
    expect(mapMediaStatus(null)).toBe("unknown");
  });
});

describe("JellyseerrClient", () => {
  function makeClient() {
    return createJellyseerrClient({ url: "http://jellyseerr:5055", apiKey: "test-key" });
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
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const client = makeClient();
    await expect(client.getRequests()).rejects.toThrow("Jellyseerr API error: 500");
  });
});

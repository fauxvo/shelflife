import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("TautulliClient", () => {
  let getTautulliClient: () => any;

  beforeEach(async () => {
    mockFetch.mockReset();
    vi.resetModules();
    const mod = await import("../tautulli");
    getTautulliClient = mod.getTautulliClient;
  });

  it("throws without env vars", async () => {
    const origUrl = process.env.TAUTULLI_URL;
    const origKey = process.env.TAUTULLI_API_KEY;
    delete process.env.TAUTULLI_URL;
    delete process.env.TAUTULLI_API_KEY;

    vi.resetModules();
    const mod = await import("../tautulli");
    expect(() => mod.getTautulliClient()).toThrow("TAUTULLI_URL and TAUTULLI_API_KEY must be set");

    process.env.TAUTULLI_URL = origUrl;
    process.env.TAUTULLI_API_KEY = origKey;
  });

  function mockTautulliResponse(data: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: { result: "success", message: null, data },
        }),
    });
  }

  it("getHistory returns records", async () => {
    mockTautulliResponse({
      data: [
        {
          reference_id: 1,
          user_id: 10,
          user: "testuser",
          rating_key: "100",
          title: "Test Movie",
          watched_status: 1,
          play_count: 2,
          stopped: 1700000000,
        },
      ],
    });

    const client = getTautulliClient();
    const history = await client.getHistory("100");
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe("Test Movie");
  });

  it("getHistory returns empty array when data is null", async () => {
    mockTautulliResponse(null);

    const client = getTautulliClient();
    const history = await client.getHistory("100");
    expect(history).toEqual([]);
  });

  it("getWatchStatusForItem aggregates records by user", async () => {
    mockTautulliResponse({
      data: [
        { user_id: 10, rating_key: "100", watched_status: 0, stopped: 1700000000 },
        { user_id: 10, rating_key: "100", watched_status: 1, stopped: 1700100000 },
        { user_id: 20, rating_key: "100", watched_status: 1, stopped: 1700050000 },
      ],
    });

    const client = getTautulliClient();
    const status = await client.getWatchStatusForItem("100");
    expect(status).toHaveLength(2);

    // User 10 has 2 plays, watched=true (from second record), latest timestamp
    const user10 = status[0];
    expect(user10.playCount).toBe(2);
    expect(user10.watched).toBe(true);

    // User 20 has 1 play
    const user20 = status[1];
    expect(user20.playCount).toBe(1);
    expect(user20.watched).toBe(true);
  });

  it("getWatchStatusForItem skips records with no user_id", async () => {
    mockTautulliResponse({
      data: [
        { user_id: null, rating_key: "100", watched_status: 1, stopped: 1700000000 },
        { user_id: 10, rating_key: "100", watched_status: 1, stopped: 1700000000 },
      ],
    });

    const client = getTautulliClient();
    const status = await client.getWatchStatusForItem("100");
    expect(status).toHaveLength(1);
  });

  it("getWatchStatusForItem picks latest timestamp", async () => {
    mockTautulliResponse({
      data: [
        { user_id: 10, rating_key: "100", watched_status: 0, stopped: 1700200000 },
        { user_id: 10, rating_key: "100", watched_status: 0, stopped: 1700100000 },
      ],
    });

    const client = getTautulliClient();
    const status = await client.getWatchStatusForItem("100");
    const laterDate = new Date(1700200000 * 1000).toISOString();
    expect(status[0].lastWatchedAt).toBe(laterDate);
  });

  it("getUsers returns user list", async () => {
    mockTautulliResponse([
      { user_id: 1, username: "user1", friendly_name: "User One" },
      { user_id: 2, username: "user2", friendly_name: "User Two" },
    ]);

    const client = getTautulliClient();
    const users = await client.getUsers();
    expect(users).toHaveLength(2);
    expect(users[0].username).toBe("user1");
  });

  it("getUsers returns empty array for non-array data", async () => {
    mockTautulliResponse("not an array");

    const client = getTautulliClient();
    const users = await client.getUsers();
    expect(users).toEqual([]);
  });

  it("getLibraryMediaInfo returns items", async () => {
    mockTautulliResponse({
      data: [
        { rating_key: "100", title: "Movie 1", year: 2024, play_count: 5 },
        { rating_key: "101", title: "Movie 2", year: 2023, play_count: 0 },
      ],
    });

    const client = getTautulliClient();
    const items = await client.getLibraryMediaInfo("1");
    expect(items).toHaveLength(2);
  });

  it("getLibraryMediaInfo returns empty for null data", async () => {
    mockTautulliResponse(null);

    const client = getTautulliClient();
    const items = await client.getLibraryMediaInfo("1");
    expect(items).toEqual([]);
  });

  it("throws when result is not 'success'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: { result: "error", message: "Something went wrong", data: null },
        }),
    });

    const client = getTautulliClient();
    await expect(client.getHistory("100")).rejects.toThrow("Tautulli error: Something went wrong");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const client = getTautulliClient();
    await expect(client.getHistory("100")).rejects.toThrow("Tautulli API error: 500");
  });
});

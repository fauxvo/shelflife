import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTracearrClient } from "../tracearr";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("TracearrClient", () => {
  function makeClient() {
    return createTracearrClient({ url: "http://tracearr:7880", apiKey: "trr_pub_testtoken" });
  }

  function mockTracearrResponse(data: unknown, meta?: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data, meta }),
    });
  }

  it("getHistory returns sessions with total count", async () => {
    mockTracearrResponse(
      [
        {
          mediaTitle: "Test Movie",
          mediaType: "movie",
          durationMs: 7200000,
          totalDurationMs: 7200000,
          watched: true,
          user: { id: "u1", username: "testuser" },
          startedAt: "2024-06-01T00:00:00Z",
          stoppedAt: "2024-06-01T02:00:00Z",
        },
      ],
      { page: 1, pageSize: 100, total: 1 }
    );

    const client = makeClient();
    const { sessions, total } = await client.getHistory();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].mediaTitle).toBe("Test Movie");
    expect(sessions[0].watched).toBe(true);
    expect(total).toBe(1);
  });

  it("getHistory sends correct Authorization header", async () => {
    mockTracearrResponse([], { page: 1, pageSize: 100, total: 0 });

    const client = makeClient();
    await client.getHistory();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/public/history"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer trr_pub_testtoken",
        }),
      })
    );
  });

  it("getHistory handles bigint string values for durationMs", async () => {
    mockTracearrResponse(
      [
        {
          mediaTitle: "Big Movie",
          mediaType: "movie",
          durationMs: "7200000",
          totalDurationMs: "9000000",
          watched: true,
          user: { id: "u1", username: "testuser" },
          startedAt: "2024-06-01T00:00:00Z",
        },
      ],
      { page: 1, pageSize: 100, total: 1 }
    );

    const client = makeClient();
    const { sessions } = await client.getHistory();
    expect(sessions[0].durationMs).toBe(7200000);
    expect(sessions[0].totalDurationMs).toBe(9000000);
  });

  it("getHistory clamps pageSize to 100", async () => {
    mockTracearrResponse([], { page: 1, pageSize: 100, total: 0 });

    const client = makeClient();
    await client.getHistory(1, 500);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const url = new URL(calledUrl);
    expect(url.searchParams.get("pageSize")).toBe("100");
  });

  it("getAllHistory paginates through multiple pages", async () => {
    // Page 1: 100 items
    const page1Sessions = Array.from({ length: 100 }, (_, i) => ({
      mediaTitle: `Movie ${i}`,
      mediaType: "movie",
      durationMs: 7200000,
      totalDurationMs: 7200000,
      watched: true,
      user: { id: "u1", username: "testuser" },
      startedAt: "2024-06-01T00:00:00Z",
    }));
    mockTracearrResponse(page1Sessions, {
      page: 1,
      pageSize: 100,
      total: 150,
    });

    // Page 2: 50 items
    const page2Sessions = Array.from({ length: 50 }, (_, i) => ({
      mediaTitle: `Movie ${100 + i}`,
      mediaType: "movie",
      durationMs: 7200000,
      totalDurationMs: 7200000,
      watched: false,
      user: { id: "u1", username: "testuser" },
      startedAt: "2024-06-01T00:00:00Z",
    }));
    mockTracearrResponse(page2Sessions, {
      page: 2,
      pageSize: 100,
      total: 150,
    });

    const client = makeClient();
    const sessions = await client.getAllHistory();
    expect(sessions).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("getUsers returns user list", async () => {
    mockTracearrResponse([
      { id: "u1", username: "user1", displayName: "User One", sessionCount: 10 },
      { id: "u2", username: "user2", sessionCount: 5, lastActivityAt: "2024-06-01T00:00:00Z" },
    ]);

    const client = makeClient();
    const users = await client.getUsers();
    expect(users).toHaveLength(2);
    expect(users[0].username).toBe("user1");
    expect(users[1].sessionCount).toBe(5);
  });

  it("healthCheck returns success on valid response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });

    const client = makeClient();
    const result = await client.healthCheck();
    expect(result.success).toBe(true);
  });

  it("healthCheck returns failure on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const client = makeClient();
    const result = await client.healthCheck();
    expect(result.success).toBe(false);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const client = makeClient();
    await expect(client.getHistory()).rejects.toThrow("Tracearr API error: 401");
  });

  it("strips trailing slash from base URL", async () => {
    const client = createTracearrClient({
      url: "http://tracearr:7880/",
      apiKey: "trr_pub_test",
    });

    mockTracearrResponse([], { page: 1, pageSize: 100, total: 0 });
    await client.getHistory();

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("http://tracearr:7880/api/v1/public/history");
    expect(calledUrl).not.toContain("//api");
  });

  it("handles sessions with episode mediaType and showTitle", async () => {
    mockTracearrResponse(
      [
        {
          mediaTitle: "Pilot",
          mediaType: "episode",
          showTitle: "Breaking Bad",
          seasonNumber: 1,
          episodeNumber: 1,
          year: 2008,
          durationMs: 3480000,
          totalDurationMs: 3480000,
          watched: true,
          user: { id: "u1", username: "testuser" },
          startedAt: "2024-06-01T00:00:00Z",
        },
      ],
      { page: 1, pageSize: 100, total: 1 }
    );

    const client = makeClient();
    const { sessions } = await client.getHistory();
    expect(sessions[0].mediaType).toBe("episode");
    expect(sessions[0].showTitle).toBe("Breaking Bad");
    expect(sessions[0].seasonNumber).toBe(1);
  });

  it("handles photo and unknown mediaTypes", async () => {
    mockTracearrResponse(
      [
        {
          mediaTitle: "Family Photo",
          mediaType: "photo",
          durationMs: 0,
          totalDurationMs: 0,
          watched: false,
          user: { id: "u1", username: "testuser" },
          startedAt: "2024-06-01T00:00:00Z",
        },
        {
          mediaTitle: "Something Else",
          mediaType: "unknown",
          durationMs: 0,
          totalDurationMs: 0,
          watched: false,
          user: { id: "u2", username: "testuser2" },
          startedAt: "2024-06-01T00:00:00Z",
        },
      ],
      { page: 1, pageSize: 100, total: 2 }
    );

    const client = makeClient();
    const { sessions } = await client.getHistory();
    expect(sessions[0].mediaType).toBe("photo");
    expect(sessions[1].mediaType).toBe("unknown");
  });
});

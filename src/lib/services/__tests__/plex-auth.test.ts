import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlexPin, checkPlexPin, getPlexUser, getPlexAuthUrl } from "../plex-auth";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("createPlexPin", () => {
  it("returns a pin on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123, code: "abc123", authToken: null }),
    });

    const pin = await createPlexPin();
    expect(pin).toEqual({ id: 123, code: "abc123", authToken: null });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://plex.tv/api/v2/pins",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(createPlexPin()).rejects.toThrow("Failed to create Plex PIN: 500");
  });

  it("throws on malformed response (Zod validation)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ bad: "data" }),
    });
    await expect(createPlexPin()).rejects.toThrow();
  });
});

describe("checkPlexPin", () => {
  it("returns pin with null authToken (not yet authenticated)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123, code: "abc123", authToken: null }),
    });

    const pin = await checkPlexPin(123);
    expect(pin.authToken).toBeNull();
  });

  it("returns pin with authToken when authenticated", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123, code: "abc123", authToken: "token-xyz" }),
    });

    const pin = await checkPlexPin(123);
    expect(pin.authToken).toBe("token-xyz");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(checkPlexPin(999)).rejects.toThrow("Failed to check Plex PIN: 404");
  });
});

describe("getPlexUser", () => {
  it("returns user object on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 42,
          uuid: "uuid-123",
          email: "user@example.com",
          username: "plexuser",
          title: "Plex User",
          thumb: "https://plex.tv/thumb.jpg",
        }),
    });

    const user = await getPlexUser("my-token");
    expect(user.id).toBe(42);
    expect(user.username).toBe("plexuser");
    expect(user.email).toBe("user@example.com");
  });

  it("includes X-Plex-Token header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, username: "u" }),
    });

    await getPlexUser("my-token");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://plex.tv/api/v2/user",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Plex-Token": "my-token" }),
      })
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(getPlexUser("bad-token")).rejects.toThrow("Failed to get Plex user: 401");
  });
});

describe("getPlexAuthUrl", () => {
  it("returns correct URL with clientId and code", () => {
    const url = getPlexAuthUrl({ id: 1, code: "test-code" });
    expect(url).toContain("https://app.plex.tv/auth");
    expect(url).toContain("clientID=test-plex-client-id");
    expect(url).toContain("code=test-code");
  });

  it("falls back to 'shelflife' when env not set", () => {
    const original = process.env.PLEX_CLIENT_ID;
    delete process.env.PLEX_CLIENT_ID;
    const url = getPlexAuthUrl({ id: 1, code: "test-code" });
    expect(url).toContain("clientID=shelflife");
    process.env.PLEX_CLIENT_ID = original;
  });
});

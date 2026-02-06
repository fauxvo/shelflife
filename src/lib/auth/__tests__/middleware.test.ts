import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireAdmin, handleAuthError, AuthError } from "../middleware";

vi.mock("../session", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "../session";
const mockGetSession = vi.mocked(getSession);

beforeEach(() => {
  mockGetSession.mockReset();
});

describe("requireAuth", () => {
  it("returns session when valid", async () => {
    const session = { userId: 1, plexId: "plex-1", username: "user", isAdmin: false };
    mockGetSession.mockResolvedValueOnce(session);

    const result = await requireAuth();
    expect(result).toEqual(session);
  });

  it("throws AuthError(401) when session is null", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    try {
      await requireAuth();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
      expect((err as AuthError).message).toBe("Not authenticated");
    }
  });
});

describe("requireAdmin", () => {
  it("returns session when isAdmin is true", async () => {
    const session = { userId: 1, plexId: "plex-1", username: "admin", isAdmin: true };
    mockGetSession.mockResolvedValueOnce(session);

    const result = await requireAdmin();
    expect(result).toEqual(session);
  });

  it("throws AuthError(403) when isAdmin is false", async () => {
    const session = { userId: 1, plexId: "plex-1", username: "user", isAdmin: false };
    mockGetSession.mockResolvedValueOnce(session);

    try {
      await requireAdmin();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(403);
    }
  });

  it("throws AuthError(401) when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    try {
      await requireAdmin();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
    }
  });
});

describe("handleAuthError", () => {
  it("returns correct status and message for AuthError", async () => {
    const response = handleAuthError(new AuthError("Forbidden", 403));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 500 for unknown errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleAuthError(new Error("something unexpected"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    consoleSpy.mockRestore();
  });
});

describe("AuthError", () => {
  it("stores status and message", () => {
    const err = new AuthError("Test message", 418);
    expect(err.message).toBe("Test message");
    expect(err.status).toBe(418);
    expect(err).toBeInstanceOf(Error);
  });
});

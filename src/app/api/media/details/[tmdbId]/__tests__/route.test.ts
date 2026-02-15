import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createRequest } from "@/test/helpers/request";

const mockRequireAuth = vi.fn();

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: () => mockRequireAuth(),
  handleAuthError: (error: unknown) => handleAuthError(error),
  AuthError,
}));

const mockGetMediaDetails = vi.fn();

vi.mock("@/lib/services/overseerr", () => ({
  getOverseerrClient: () => ({
    getMediaDetails: mockGetMediaDetails,
  }),
}));

const { GET } = await import("../route");

const userSession = { userId: 1, plexId: "plex-user-1", username: "testuser", isAdmin: false };

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockGetMediaDetails.mockReset();
});

describe("GET /api/media/[tmdbId]/details", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError("Unauthorized", 401));
    const req = createRequest("http://localhost:3000/api/media/123/details?type=movie");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "123" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid tmdbId", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media/abc/details?type=movie");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "abc" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid TMDB ID");
  });

  it("returns 400 for missing type param", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media/123/details");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "123" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid type");
  });

  it("returns 400 for invalid type param", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    const req = createRequest("http://localhost:3000/api/media/123/details?type=anime");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "123" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid type");
  });

  it("returns overview for a movie", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    mockGetMediaDetails.mockResolvedValue({ overview: "A great movie about testing." });
    const req = createRequest("http://localhost:3000/api/media/550/details?type=movie");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "550" }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.overview).toBe("A great movie about testing.");
    expect(mockGetMediaDetails).toHaveBeenCalledWith(550, "movie");
  });

  it("returns overview for a TV show", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    mockGetMediaDetails.mockResolvedValue({ overview: "A compelling series." });
    const req = createRequest("http://localhost:3000/api/media/1399/details?type=tv");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "1399" }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.overview).toBe("A compelling series.");
    expect(mockGetMediaDetails).toHaveBeenCalledWith(1399, "tv");
  });

  it("returns null overview when not available", async () => {
    mockRequireAuth.mockResolvedValue(userSession);
    mockGetMediaDetails.mockResolvedValue({ overview: null });
    const req = createRequest("http://localhost:3000/api/media/550/details?type=movie");
    const res = await GET(req, { params: Promise.resolve({ tmdbId: "550" }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.overview).toBeNull();
  });
});

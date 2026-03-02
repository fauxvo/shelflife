import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";
import { createRequest } from "@/test/helpers/request";
import { NextResponse } from "next/server";
import { appSettings } from "@/lib/db/schema";
import { SERVICE_TYPES } from "@/lib/services/service-config";

const mockRequireAdmin = vi.fn();

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
  console.error("Unexpected error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: vi.fn(),
  requireAdmin: () => mockRequireAdmin(),
  handleAuthError: (error: unknown) => handleAuthError(error),
  AuthError,
}));

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET, PUT } = await import("../route");

const adminSession = { userId: 1, plexId: "plex-admin", username: "admin", isAdmin: true };

const ENV_KEYS = SERVICE_TYPES.flatMap((t) => [
  `${t.toUpperCase()}_URL`,
  `${t.toUpperCase()}_API_KEY`,
]);

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  testDb = createTestDb();
  mockRequireAdmin.mockReset();
  // Save and clear service env vars to isolate tests
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  // Restore env vars
  for (const key of ENV_KEYS) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

describe("GET /api/admin/settings/services", () => {
  it("returns all services as null when nothing is configured", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeProvider).toBe("auto");
    expect(data.services.seerr).toBeNull();
    expect(data.services.tautulli).toBeNull();
  });

  it("returns configured services with masked API keys", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    await testDb.db.insert(appSettings).values([
      { key: "service_seerr_url", value: "http://seerr:5055" },
      { key: "service_seerr_api_key", value: "abcdefghijklmnop" },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.services.seerr).toEqual({
      url: "http://seerr:5055",
      apiKey: "abcd...mnop",
    });
  });

  it("rejects non-admin users", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Forbidden", 403));

    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/admin/settings/services", () => {
  it("saves service configs and returns masked response", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        services: {
          seerr: { url: "http://seerr:5055", apiKey: "my-seerr-api-key-1234" },
        },
      },
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.services.seerr).toEqual({
      url: "http://seerr:5055",
      apiKey: "my-s...1234",
    });
  });

  it("clears a service config when set to null", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // First save a config
    await testDb.db.insert(appSettings).values([
      { key: "service_tautulli_url", value: "http://tautulli:8181" },
      { key: "service_tautulli_api_key", value: "tautulli-key-12345678" },
    ]);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        services: { tautulli: null },
      },
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.services.tautulli).toBeNull();
  });

  it("saves active provider setting", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        activeProvider: "overseerr",
      },
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeProvider).toBe("overseerr");
  });

  it("rejects invalid request body (bad URL)", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        services: {
          seerr: { url: "not-a-url", apiKey: "key" },
        },
      },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Invalid request");
    expect(data.details).toBeDefined();
  });

  it("rejects invalid request body (empty API key)", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        services: {
          seerr: { url: "http://seerr:5055", apiKey: "" },
        },
      },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid active provider value", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        activeProvider: "invalid-provider",
      },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid service type key", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        services: {
          plex: { url: "http://plex:32400", apiKey: "key" },
        },
      },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("rejects non-admin users", async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError("Forbidden", 403));

    const req = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: { services: {} },
    });

    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("persists settings across reads", async () => {
    mockRequireAdmin.mockResolvedValue(adminSession);

    // Write
    const putReq = createRequest("http://localhost:3000/api/admin/settings/services", {
      method: "PUT",
      body: {
        services: {
          radarr: { url: "http://radarr:7878", apiKey: "radarr-key-long-enough" },
        },
        activeProvider: "seerr",
      },
    });
    await PUT(putReq);

    // Read back
    const res = await GET();
    const data = await res.json();

    expect(data.services.radarr).toEqual({
      url: "http://radarr:7878",
      apiKey: "rada...ough",
    });
    expect(data.activeProvider).toBe("seerr");
  });
});

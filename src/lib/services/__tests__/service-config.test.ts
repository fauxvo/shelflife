import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/helpers/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const {
  getServiceConfig,
  setServiceConfig,
  clearServiceConfig,
  getAllServiceConfigs,
  getActiveRequestProvider,
  setActiveRequestProvider,
  maskApiKey,
  invalidateClients,
  getClientGeneration,
  SERVICE_TYPES,
} = await import("../service-config");

const originalEnv = process.env;

beforeEach(() => {
  testDb = createTestDb();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("SERVICE_TYPES", () => {
  it("exports all 7 service types", () => {
    expect(SERVICE_TYPES).toEqual([
      "seerr",
      "overseerr",
      "jellyseerr",
      "tautulli",
      "tracearr",
      "sonarr",
      "radarr",
    ]);
  });
});

describe("getServiceConfig", () => {
  it("returns null when neither DB nor env var is set", async () => {
    delete process.env.SEERR_URL;
    delete process.env.SEERR_API_KEY;

    const config = await getServiceConfig("seerr");
    expect(config).toBeNull();
  });

  it("falls back to env vars when DB has no entries", async () => {
    process.env.TAUTULLI_URL = "http://tautulli:8181";
    process.env.TAUTULLI_API_KEY = "env-key";

    const config = await getServiceConfig("tautulli");
    expect(config).toEqual({ url: "http://tautulli:8181", apiKey: "env-key" });
  });

  it("returns null when only URL is set (no API key)", async () => {
    process.env.SONARR_URL = "http://sonarr:8989";
    delete process.env.SONARR_API_KEY;

    const config = await getServiceConfig("sonarr");
    expect(config).toBeNull();
  });

  it("DB values take priority over env vars", async () => {
    process.env.RADARR_URL = "http://radarr-env:7878";
    process.env.RADARR_API_KEY = "env-key";

    await testDb.db.insert(appSettings).values([
      { key: "service_radarr_url", value: "http://radarr-db:7878" },
      { key: "service_radarr_api_key", value: "db-key" },
    ]);

    const config = await getServiceConfig("radarr");
    expect(config).toEqual({ url: "http://radarr-db:7878", apiKey: "db-key" });
  });

  it("mixes DB url with env apiKey", async () => {
    delete process.env.OVERSEERR_URL;
    process.env.OVERSEERR_API_KEY = "env-api-key";

    await testDb.db
      .insert(appSettings)
      .values([{ key: "service_overseerr_url", value: "http://overseerr-db:5055" }]);

    const config = await getServiceConfig("overseerr");
    expect(config).toEqual({ url: "http://overseerr-db:5055", apiKey: "env-api-key" });
  });
});

describe("setServiceConfig / clearServiceConfig", () => {
  it("saves and retrieves a config from DB", async () => {
    delete process.env.SEERR_URL;
    delete process.env.SEERR_API_KEY;

    await setServiceConfig("seerr", { url: "http://seerr:5055", apiKey: "test-key" });

    const config = await getServiceConfig("seerr");
    expect(config).toEqual({ url: "http://seerr:5055", apiKey: "test-key" });
  });

  it("updates existing config on second save", async () => {
    delete process.env.SEERR_URL;
    delete process.env.SEERR_API_KEY;

    await setServiceConfig("seerr", { url: "http://seerr:5055", apiKey: "key1" });
    await setServiceConfig("seerr", { url: "http://seerr:5056", apiKey: "key2" });

    const config = await getServiceConfig("seerr");
    expect(config).toEqual({ url: "http://seerr:5056", apiKey: "key2" });
  });

  it("clearServiceConfig removes DB entries (env fallback still works)", async () => {
    process.env.JELLYSEERR_URL = "http://env-jelly:5055";
    process.env.JELLYSEERR_API_KEY = "env-key";

    await setServiceConfig("jellyseerr", { url: "http://db-jelly:5055", apiKey: "db-key" });
    await clearServiceConfig("jellyseerr");

    const config = await getServiceConfig("jellyseerr");
    // Falls back to env vars after clearing DB
    expect(config).toEqual({ url: "http://env-jelly:5055", apiKey: "env-key" });
  });

  it("clearServiceConfig returns null when no env fallback", async () => {
    delete process.env.SONARR_URL;
    delete process.env.SONARR_API_KEY;

    await setServiceConfig("sonarr", { url: "http://sonarr:8989", apiKey: "key" });
    await clearServiceConfig("sonarr");

    const config = await getServiceConfig("sonarr");
    expect(config).toBeNull();
  });
});

describe("getAllServiceConfigs", () => {
  it("returns null for all services when nothing is configured", async () => {
    // Clear all env vars
    for (const type of SERVICE_TYPES) {
      delete process.env[`${type.toUpperCase()}_URL`];
      delete process.env[`${type.toUpperCase()}_API_KEY`];
    }

    const configs = await getAllServiceConfigs();
    for (const type of SERVICE_TYPES) {
      expect(configs[type]).toBeNull();
    }
  });

  it("returns a mix of DB and env configs", async () => {
    // Clear all
    for (const type of SERVICE_TYPES) {
      delete process.env[`${type.toUpperCase()}_URL`];
      delete process.env[`${type.toUpperCase()}_API_KEY`];
    }

    // Set one via DB
    await setServiceConfig("seerr", { url: "http://seerr:5055", apiKey: "db-key" });

    // Set one via env
    process.env.TAUTULLI_URL = "http://tautulli:8181";
    process.env.TAUTULLI_API_KEY = "env-key";

    const configs = await getAllServiceConfigs();
    expect(configs.seerr).toEqual({ url: "http://seerr:5055", apiKey: "db-key" });
    expect(configs.tautulli).toEqual({ url: "http://tautulli:8181", apiKey: "env-key" });
    expect(configs.overseerr).toBeNull();
    expect(configs.sonarr).toBeNull();
  });
});

describe("getActiveRequestProvider / setActiveRequestProvider", () => {
  it("defaults to 'auto' when no setting exists", async () => {
    const provider = await getActiveRequestProvider();
    expect(provider).toBe("auto");
  });

  it("saves and retrieves provider setting", async () => {
    await setActiveRequestProvider("overseerr");
    const provider = await getActiveRequestProvider();
    expect(provider).toBe("overseerr");
  });

  it("overwrites previous setting", async () => {
    await setActiveRequestProvider("seerr");
    await setActiveRequestProvider("jellyseerr");
    const provider = await getActiveRequestProvider();
    expect(provider).toBe("jellyseerr");
  });
});

describe("maskApiKey", () => {
  it("masks short keys completely", () => {
    expect(maskApiKey("abc")).toBe("****");
    expect(maskApiKey("12345678")).toBe("****");
  });

  it("shows first 4 and last 4 chars for longer keys", () => {
    expect(maskApiKey("abcdefghij")).toBe("abcd...ghij");
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1...cdef");
  });
});

describe("client generation", () => {
  it("increments on setServiceConfig", async () => {
    const before = getClientGeneration();
    await setServiceConfig("seerr", { url: "http://seerr:5055", apiKey: "key" });
    expect(getClientGeneration()).toBe(before + 1);
  });

  it("increments on clearServiceConfig", async () => {
    const before = getClientGeneration();
    await clearServiceConfig("seerr");
    expect(getClientGeneration()).toBe(before + 1);
  });

  it("increments on setActiveRequestProvider", async () => {
    const before = getClientGeneration();
    await setActiveRequestProvider("seerr");
    expect(getClientGeneration()).toBe(before + 1);
  });

  it("increments on invalidateClients", () => {
    const before = getClientGeneration();
    invalidateClients();
    expect(getClientGeneration()).toBe(before + 1);
  });
});

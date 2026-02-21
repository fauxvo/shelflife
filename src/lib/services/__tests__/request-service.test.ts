import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("request-service", () => {
  const origSeerrUrl = process.env.SEERR_URL;
  const origSeerrKey = process.env.SEERR_API_KEY;
  const origOverseerrUrl = process.env.OVERSEERR_URL;
  const origOverseerrKey = process.env.OVERSEERR_API_KEY;
  const origJellyseerrUrl = process.env.JELLYSEERR_URL;
  const origJellyseerrKey = process.env.JELLYSEERR_API_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env vars
    if (origSeerrUrl !== undefined) process.env.SEERR_URL = origSeerrUrl;
    else delete process.env.SEERR_URL;
    if (origSeerrKey !== undefined) process.env.SEERR_API_KEY = origSeerrKey;
    else delete process.env.SEERR_API_KEY;
    if (origOverseerrUrl !== undefined) process.env.OVERSEERR_URL = origOverseerrUrl;
    else delete process.env.OVERSEERR_URL;
    if (origOverseerrKey !== undefined) process.env.OVERSEERR_API_KEY = origOverseerrKey;
    else delete process.env.OVERSEERR_API_KEY;
    if (origJellyseerrUrl !== undefined) process.env.JELLYSEERR_URL = origJellyseerrUrl;
    else delete process.env.JELLYSEERR_URL;
    if (origJellyseerrKey !== undefined) process.env.JELLYSEERR_API_KEY = origJellyseerrKey;
    else delete process.env.JELLYSEERR_API_KEY;
  });

  function clearAllProviderEnvVars() {
    delete process.env.SEERR_URL;
    delete process.env.SEERR_API_KEY;
    delete process.env.OVERSEERR_URL;
    delete process.env.OVERSEERR_API_KEY;
    delete process.env.JELLYSEERR_URL;
    delete process.env.JELLYSEERR_API_KEY;
  }

  describe("getActiveProvider", () => {
    it("returns 'seerr' when SEERR env vars are set", async () => {
      process.env.SEERR_URL = "http://seerr:5055";
      process.env.SEERR_API_KEY = "seerr-key";
      clearAllProviderEnvVars();
      process.env.SEERR_URL = "http://seerr:5055";
      process.env.SEERR_API_KEY = "seerr-key";

      const { getActiveProvider } = await import("../request-service");
      expect(getActiveProvider()).toBe("seerr");
    });

    it("returns 'overseerr' when only OVERSEERR env vars are set", async () => {
      clearAllProviderEnvVars();
      process.env.OVERSEERR_URL = "http://overseerr:5055";
      process.env.OVERSEERR_API_KEY = "overseerr-key";

      const { getActiveProvider } = await import("../request-service");
      expect(getActiveProvider()).toBe("overseerr");
    });

    it("returns 'jellyseerr' when only JELLYSEERR env vars are set", async () => {
      clearAllProviderEnvVars();
      process.env.JELLYSEERR_URL = "http://jellyseerr:5055";
      process.env.JELLYSEERR_API_KEY = "jellyseerr-key";

      const { getActiveProvider } = await import("../request-service");
      expect(getActiveProvider()).toBe("jellyseerr");
    });

    it("returns 'seerr' when all three are configured (seerr takes priority)", async () => {
      process.env.SEERR_URL = "http://seerr:5055";
      process.env.SEERR_API_KEY = "seerr-key";
      process.env.OVERSEERR_URL = "http://overseerr:5055";
      process.env.OVERSEERR_API_KEY = "overseerr-key";
      process.env.JELLYSEERR_URL = "http://jellyseerr:5055";
      process.env.JELLYSEERR_API_KEY = "jellyseerr-key";

      const { getActiveProvider } = await import("../request-service");
      expect(getActiveProvider()).toBe("seerr");
    });

    it("throws when none is configured", async () => {
      clearAllProviderEnvVars();

      const { getActiveProvider } = await import("../request-service");
      expect(() => getActiveProvider()).toThrow("No request service configured");
    });

    it("falls back to overseerr when SEERR_URL is set but SEERR_API_KEY is missing", async () => {
      clearAllProviderEnvVars();
      process.env.SEERR_URL = "http://seerr:5055";
      process.env.OVERSEERR_URL = "http://overseerr:5055";
      process.env.OVERSEERR_API_KEY = "overseerr-key";

      const { getActiveProvider } = await import("../request-service");
      expect(getActiveProvider()).toBe("overseerr");
    });

    it("falls back to jellyseerr when seerr and overseerr are incomplete", async () => {
      clearAllProviderEnvVars();
      process.env.SEERR_URL = "http://seerr:5055";
      // SEERR_API_KEY missing
      process.env.OVERSEERR_URL = "http://overseerr:5055";
      // OVERSEERR_API_KEY missing
      process.env.JELLYSEERR_URL = "http://jellyseerr:5055";
      process.env.JELLYSEERR_API_KEY = "jellyseerr-key";

      const { getActiveProvider } = await import("../request-service");
      expect(getActiveProvider()).toBe("jellyseerr");
    });
  });

  describe("getProviderLabel", () => {
    it("returns 'Seerr' when seerr is active", async () => {
      clearAllProviderEnvVars();
      process.env.SEERR_URL = "http://seerr:5055";
      process.env.SEERR_API_KEY = "seerr-key";

      const { getProviderLabel } = await import("../request-service");
      expect(getProviderLabel()).toBe("Seerr");
    });

    it("returns 'Overseerr' when overseerr is active", async () => {
      clearAllProviderEnvVars();
      process.env.OVERSEERR_URL = "http://overseerr:5055";
      process.env.OVERSEERR_API_KEY = "overseerr-key";

      const { getProviderLabel } = await import("../request-service");
      expect(getProviderLabel()).toBe("Overseerr");
    });

    it("returns 'Jellyseerr' when jellyseerr is active", async () => {
      clearAllProviderEnvVars();
      process.env.JELLYSEERR_URL = "http://jellyseerr:5055";
      process.env.JELLYSEERR_API_KEY = "jellyseerr-key";

      const { getProviderLabel } = await import("../request-service");
      expect(getProviderLabel()).toBe("Jellyseerr");
    });
  });

  describe("getRequestServiceClient", () => {
    it("returns a client when seerr is configured", async () => {
      clearAllProviderEnvVars();
      process.env.SEERR_URL = "http://seerr:5055";
      process.env.SEERR_API_KEY = "seerr-key";

      const { getRequestServiceClient } = await import("../request-service");
      const client = getRequestServiceClient();
      expect(client).toBeDefined();
      expect(typeof client.getAllRequests).toBe("function");
      expect(typeof client.getMediaDetails).toBe("function");
      expect(typeof client.deleteMedia).toBe("function");
    });

    it("returns a client when overseerr is configured", async () => {
      clearAllProviderEnvVars();
      process.env.OVERSEERR_URL = "http://overseerr:5055";
      process.env.OVERSEERR_API_KEY = "overseerr-key";

      const { getRequestServiceClient } = await import("../request-service");
      const client = getRequestServiceClient();
      expect(client).toBeDefined();
      expect(typeof client.getAllRequests).toBe("function");
    });

    it("returns a client when jellyseerr is configured", async () => {
      clearAllProviderEnvVars();
      process.env.JELLYSEERR_URL = "http://jellyseerr:5055";
      process.env.JELLYSEERR_API_KEY = "jellyseerr-key";

      const { getRequestServiceClient } = await import("../request-service");
      const client = getRequestServiceClient();
      expect(client).toBeDefined();
      expect(typeof client.getAllRequests).toBe("function");
    });

    it("throws when none is configured", async () => {
      clearAllProviderEnvVars();

      const { getRequestServiceClient } = await import("../request-service");
      expect(() => getRequestServiceClient()).toThrow("No request service configured");
    });
  });
});

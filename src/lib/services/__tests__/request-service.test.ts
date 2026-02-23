import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActiveRequestProvider = vi.fn();
const mockGetServiceConfig = vi.fn();
const mockGetAllServiceConfigs = vi.fn();
const mockGetClientGeneration = vi.fn();

vi.mock("../service-config", () => ({
  getActiveRequestProvider: () => mockGetActiveRequestProvider(),
  getServiceConfig: (...args: unknown[]) => mockGetServiceConfig(...args),
  getAllServiceConfigs: () => mockGetAllServiceConfigs(),
  getClientGeneration: () => mockGetClientGeneration(),
}));

vi.mock("../seerr", () => ({
  createSeerrClient: (config: { url: string; apiKey: string }) => ({
    _provider: "seerr",
    _config: config,
    getAllRequests: vi.fn(),
    getMediaDetails: vi.fn(),
    deleteMedia: vi.fn(),
  }),
}));

vi.mock("../overseerr", () => ({
  createOverseerrClient: (config: { url: string; apiKey: string }) => ({
    _provider: "overseerr",
    _config: config,
    getAllRequests: vi.fn(),
    getMediaDetails: vi.fn(),
    deleteMedia: vi.fn(),
  }),
}));

vi.mock("../jellyseerr", () => ({
  createJellyseerrClient: (config: { url: string; apiKey: string }) => ({
    _provider: "jellyseerr",
    _config: config,
    getAllRequests: vi.fn(),
    getMediaDetails: vi.fn(),
    deleteMedia: vi.fn(),
  }),
}));

// Import after mocking
const { getActiveProvider, getProviderLabel, getRequestServiceClient } =
  await import("../request-service");

const nullConfigs = {
  seerr: null,
  overseerr: null,
  jellyseerr: null,
  tautulli: null,
  sonarr: null,
  radarr: null,
};

let generationCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  generationCounter++;
  mockGetClientGeneration.mockReturnValue(generationCounter); // unique each test to bust cache
  mockGetAllServiceConfigs.mockResolvedValue({ ...nullConfigs });
});

describe("getActiveProvider", () => {
  it("returns 'seerr' when auto-detect finds seerr config", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      seerr: { url: "http://seerr:5055", apiKey: "key" },
    });

    expect(await getActiveProvider()).toBe("seerr");
  });

  it("returns 'overseerr' when only overseerr is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      overseerr: { url: "http://overseerr:5055", apiKey: "key" },
    });

    expect(await getActiveProvider()).toBe("overseerr");
  });

  it("returns 'jellyseerr' when only jellyseerr is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      jellyseerr: { url: "http://jellyseerr:5055", apiKey: "key" },
    });

    expect(await getActiveProvider()).toBe("jellyseerr");
  });

  it("returns 'seerr' when all three are configured (seerr takes priority)", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    const allConfigured = { url: "http://any:5055", apiKey: "key" };
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      seerr: allConfigured,
      overseerr: allConfigured,
      jellyseerr: allConfigured,
    });

    expect(await getActiveProvider()).toBe("seerr");
  });

  it("throws when none is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({ ...nullConfigs });

    await expect(getActiveProvider()).rejects.toThrow("No request service configured");
  });

  it("uses explicit provider setting when configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("overseerr");
    mockGetServiceConfig.mockImplementation(async (type: string) => {
      if (type === "overseerr") return { url: "http://overseerr:5055", apiKey: "key" };
      return null;
    });

    expect(await getActiveProvider()).toBe("overseerr");
  });

  it("falls back to auto-detect when explicit provider has no config", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("overseerr");
    mockGetServiceConfig.mockResolvedValue(null); // overseerr not configured
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      seerr: { url: "http://seerr:5055", apiKey: "key" },
    });

    expect(await getActiveProvider()).toBe("seerr");
  });
});

describe("getProviderLabel", () => {
  it("returns 'Seerr' when seerr is active", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      seerr: { url: "http://seerr:5055", apiKey: "key" },
    });
    mockGetServiceConfig.mockResolvedValue({ url: "http://seerr:5055", apiKey: "key" });

    expect(await getProviderLabel()).toBe("Seerr");
  });

  it("returns 'Overseerr' when overseerr is active", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      overseerr: { url: "http://overseerr:5055", apiKey: "key" },
    });
    mockGetServiceConfig.mockResolvedValue({ url: "http://overseerr:5055", apiKey: "key" });

    expect(await getProviderLabel()).toBe("Overseerr");
  });

  it("returns 'Jellyseerr' when jellyseerr is active", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({
      ...nullConfigs,
      jellyseerr: { url: "http://jellyseerr:5055", apiKey: "key" },
    });
    mockGetServiceConfig.mockResolvedValue({ url: "http://jellyseerr:5055", apiKey: "key" });

    expect(await getProviderLabel()).toBe("Jellyseerr");
  });
});

describe("getRequestServiceClient", () => {
  it("returns a seerr client when seerr is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    const seerrConfig = { url: "http://seerr:5055", apiKey: "seerr-key" };
    mockGetAllServiceConfigs.mockResolvedValue({ ...nullConfigs, seerr: seerrConfig });
    mockGetServiceConfig.mockResolvedValue(seerrConfig);

    const client = await getRequestServiceClient();
    expect(client).toBeDefined();
    expect(typeof client.getAllRequests).toBe("function");
    expect(typeof client.getMediaDetails).toBe("function");
    expect(typeof client.deleteMedia).toBe("function");
  });

  it("returns an overseerr client when overseerr is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    const overseerrConfig = { url: "http://overseerr:5055", apiKey: "key" };
    mockGetAllServiceConfigs.mockResolvedValue({ ...nullConfigs, overseerr: overseerrConfig });
    mockGetServiceConfig.mockResolvedValue(overseerrConfig);

    const client = await getRequestServiceClient();
    expect(client).toBeDefined();
    expect(typeof client.getAllRequests).toBe("function");
  });

  it("returns a jellyseerr client when jellyseerr is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    const jellyseerrConfig = { url: "http://jellyseerr:5055", apiKey: "key" };
    mockGetAllServiceConfigs.mockResolvedValue({ ...nullConfigs, jellyseerr: jellyseerrConfig });
    mockGetServiceConfig.mockResolvedValue(jellyseerrConfig);

    const client = await getRequestServiceClient();
    expect(client).toBeDefined();
    expect(typeof client.getAllRequests).toBe("function");
  });

  it("throws when none is configured", async () => {
    mockGetActiveRequestProvider.mockResolvedValue("auto");
    mockGetAllServiceConfigs.mockResolvedValue({ ...nullConfigs });

    await expect(getRequestServiceClient()).rejects.toThrow("No request service configured");
  });
});

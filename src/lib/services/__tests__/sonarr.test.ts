import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSonarrClient } from "../sonarr";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SonarrClient", () => {
  function makeClient() {
    return createSonarrClient({ url: "http://localhost:8989", apiKey: "test-sonarr-key" });
  }

  it("lookupByTvdbId returns series when found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([{ id: 55, title: "Test Show" }]),
    });

    const client = makeClient();
    const result = await client.lookupByTvdbId(3000);

    expect(result).toEqual({ id: 55, title: "Test Show" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8989/api/v3/series?tvdbId=3000",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Api-Key": "test-sonarr-key" }),
      })
    );
  });

  it("lookupByTvdbId returns null when not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve([]),
    });

    const client = makeClient();
    const result = await client.lookupByTvdbId(9999);

    expect(result).toBeNull();
  });

  it("deleteSeries calls correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    });

    const client = makeClient();
    await client.deleteSeries(55, true);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8989/api/v3/series/55?deleteFiles=true&addImportListExclusion=true",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "X-Api-Key": "test-sonarr-key" }),
      })
    );
  });

  it("deleteSeries throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const client = makeClient();

    await expect(client.deleteSeries(55, true)).rejects.toThrow("Sonarr API error: 500");
  });
});

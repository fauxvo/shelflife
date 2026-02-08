import { describe, it, expect } from "vitest";
import { ExternalLinks } from "../ExternalLinks";

describe("ExternalLinks", () => {
  it("returns null when no IDs provided", () => {
    const result = ExternalLinks({});
    expect(result).toBeNull();
  });

  it("returns null when IDs are null", () => {
    const result = ExternalLinks({ imdbId: null, tmdbId: null });
    expect(result).toBeNull();
  });

  it("renders when imdbId provided", () => {
    const result = ExternalLinks({ imdbId: "tt1234567" });
    expect(result).not.toBeNull();
  });

  it("renders when tmdbId provided", () => {
    const result = ExternalLinks({ tmdbId: 12345 });
    expect(result).not.toBeNull();
  });

  it("renders when both IDs provided", () => {
    const result = ExternalLinks({ imdbId: "tt1234567", tmdbId: 12345 });
    expect(result).not.toBeNull();
  });

  it("uses 'tv' type for TV media", () => {
    const result = ExternalLinks({ tmdbId: 12345, mediaType: "tv" });
    expect(result).not.toBeNull();
  });

  it("defaults to 'movie' type when mediaType not specified", () => {
    const result = ExternalLinks({ tmdbId: 12345 });
    expect(result).not.toBeNull();
  });
});

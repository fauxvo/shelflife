import { describe, it, expect } from "vitest";
import {
  voteSchema,
  syncRequestSchema,
  mediaQuerySchema,
  adminCandidatesQuerySchema,
} from "../schemas";

describe("voteSchema", () => {
  it("accepts 'keep'", () => {
    expect(voteSchema.parse({ vote: "keep" })).toEqual({ vote: "keep" });
  });

  it("accepts 'delete'", () => {
    expect(voteSchema.parse({ vote: "delete" })).toEqual({ vote: "delete" });
  });

  it("rejects invalid values", () => {
    expect(() => voteSchema.parse({ vote: "invalid" })).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => voteSchema.parse({ vote: "" })).toThrow();
  });

  it("rejects null", () => {
    expect(() => voteSchema.parse({ vote: null })).toThrow();
  });

  it("rejects missing vote field", () => {
    expect(() => voteSchema.parse({})).toThrow();
  });
});

describe("syncRequestSchema", () => {
  it("accepts 'overseerr'", () => {
    expect(syncRequestSchema.parse({ type: "overseerr" })).toEqual({ type: "overseerr" });
  });

  it("accepts 'tautulli'", () => {
    expect(syncRequestSchema.parse({ type: "tautulli" })).toEqual({ type: "tautulli" });
  });

  it("accepts 'full'", () => {
    expect(syncRequestSchema.parse({ type: "full" })).toEqual({ type: "full" });
  });

  it("defaults to 'full' when type is missing", () => {
    expect(syncRequestSchema.parse({})).toEqual({ type: "full" });
  });

  it("rejects invalid type", () => {
    expect(() => syncRequestSchema.parse({ type: "invalid" })).toThrow();
  });
});

describe("mediaQuerySchema", () => {
  it("applies all defaults for empty input", () => {
    const result = mediaQuerySchema.parse({});
    expect(result).toEqual({
      type: "all",
      status: "all",
      vote: "all",
      page: 1,
      limit: 20,
    });
  });

  it("coerces string page to number", () => {
    const result = mediaQuerySchema.parse({ page: "3" });
    expect(result.page).toBe(3);
  });

  it("coerces string limit to number", () => {
    const result = mediaQuerySchema.parse({ limit: "50" });
    expect(result.limit).toBe(50);
  });

  it("rejects page=0", () => {
    expect(() => mediaQuerySchema.parse({ page: "0" })).toThrow();
  });

  it("rejects negative page", () => {
    expect(() => mediaQuerySchema.parse({ page: "-1" })).toThrow();
  });

  it("rejects limit > 100", () => {
    expect(() => mediaQuerySchema.parse({ limit: "101" })).toThrow();
  });

  it("accepts watched='true'", () => {
    const result = mediaQuerySchema.parse({ watched: "true" });
    expect(result.watched).toBe("true");
  });

  it("accepts watched='false'", () => {
    const result = mediaQuerySchema.parse({ watched: "false" });
    expect(result.watched).toBe("false");
  });

  it("accepts watched='' (empty string)", () => {
    const result = mediaQuerySchema.parse({ watched: "" });
    expect(result.watched).toBe("");
  });

  it("rejects invalid type enum", () => {
    expect(() => mediaQuerySchema.parse({ type: "anime" })).toThrow();
  });

  it("rejects invalid status enum", () => {
    expect(() => mediaQuerySchema.parse({ status: "downloading" })).toThrow();
  });

  it("rejects invalid vote enum", () => {
    expect(() => mediaQuerySchema.parse({ vote: "maybe" })).toThrow();
  });

  it("accepts all valid type values", () => {
    for (const type of ["movie", "tv", "all"]) {
      expect(mediaQuerySchema.parse({ type }).type).toBe(type);
    }
  });

  it("accepts all valid status values", () => {
    for (const status of ["available", "pending", "processing", "partial", "unknown", "all"]) {
      expect(mediaQuerySchema.parse({ status }).status).toBe(status);
    }
  });

  it("accepts all valid vote values", () => {
    for (const vote of ["keep", "delete", "none", "all"]) {
      expect(mediaQuerySchema.parse({ vote }).vote).toBe(vote);
    }
  });
});

describe("adminCandidatesQuerySchema", () => {
  it("applies all defaults for empty input", () => {
    const result = adminCandidatesQuerySchema.parse({});
    expect(result).toEqual({
      page: 1,
      limit: 50,
      sort: "vote",
    });
  });

  it("coerces string page to number", () => {
    const result = adminCandidatesQuerySchema.parse({ page: "2" });
    expect(result.page).toBe(2);
  });

  it("coerces string limit to number", () => {
    const result = adminCandidatesQuerySchema.parse({ limit: "25" });
    expect(result.limit).toBe(25);
  });

  it("accepts sort='watched'", () => {
    expect(adminCandidatesQuerySchema.parse({ sort: "watched" }).sort).toBe("watched");
  });

  it("accepts sort='title'", () => {
    expect(adminCandidatesQuerySchema.parse({ sort: "title" }).sort).toBe("title");
  });

  it("rejects invalid sort value", () => {
    expect(() => adminCandidatesQuerySchema.parse({ sort: "date" })).toThrow();
  });

  it("rejects page=0", () => {
    expect(() => adminCandidatesQuerySchema.parse({ page: "0" })).toThrow();
  });

  it("rejects limit > 100", () => {
    expect(() => adminCandidatesQuerySchema.parse({ limit: "101" })).toThrow();
  });
});

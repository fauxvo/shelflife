import { describe, it, expect } from "vitest";
import {
  voteSchema,
  syncRequestSchema,
  mediaQuerySchema,
  communityVoteSchema,
  communityQuerySchema,
  reviewRoundCreateSchema,
  reviewActionSchema,
} from "../schemas";

describe("voteSchema", () => {
  it("rejects 'keep' (no longer valid)", () => {
    expect(() => voteSchema.parse({ vote: "keep" })).toThrow();
  });

  it("accepts 'delete'", () => {
    const result = voteSchema.parse({ vote: "delete" });
    expect(result.vote).toBe("delete");
  });

  it("accepts 'trim' with keepSeasons", () => {
    const result = voteSchema.parse({ vote: "trim", keepSeasons: 2 });
    expect(result.vote).toBe("trim");
    expect(result.keepSeasons).toBe(2);
  });

  it("rejects 'trim' without keepSeasons", () => {
    expect(() => voteSchema.parse({ vote: "trim" })).toThrow();
  });

  it("accepts 'delete' without keepSeasons", () => {
    const result = voteSchema.parse({ vote: "delete" });
    expect(result.vote).toBe("delete");
    expect(result.keepSeasons).toBeUndefined();
  });

  it("rejects keepSeasons=0", () => {
    expect(() => voteSchema.parse({ vote: "trim", keepSeasons: 0 })).toThrow();
  });

  it("rejects negative keepSeasons", () => {
    expect(() => voteSchema.parse({ vote: "trim", keepSeasons: -1 })).toThrow();
  });

  it("coerces string keepSeasons to number", () => {
    const result = voteSchema.parse({ vote: "trim", keepSeasons: "3" });
    expect(result.keepSeasons).toBe(3);
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
      sort: "title_asc",
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
    for (const status of [
      "available",
      "pending",
      "processing",
      "partial",
      "unknown",
      "removed",
      "all",
    ]) {
      expect(mediaQuerySchema.parse({ status }).status).toBe(status);
    }
  });

  it("accepts all valid vote values", () => {
    for (const vote of ["nominated", "none", "all"]) {
      expect(mediaQuerySchema.parse({ vote }).vote).toBe(vote);
    }
  });

  it("accepts search string", () => {
    const result = mediaQuerySchema.parse({ search: "test movie" });
    expect(result.search).toBe("test movie");
  });

  it("rejects search > 200 chars", () => {
    expect(() => mediaQuerySchema.parse({ search: "a".repeat(201) })).toThrow();
  });

  it("accepts all valid sort values", () => {
    for (const sort of ["title_asc", "title_desc", "requested_newest", "requested_oldest"]) {
      expect(mediaQuerySchema.parse({ sort }).sort).toBe(sort);
    }
  });

  it("rejects invalid sort value", () => {
    expect(() => mediaQuerySchema.parse({ sort: "invalid" })).toThrow();
  });
});

describe("communityVoteSchema", () => {
  it("accepts 'keep'", () => {
    expect(communityVoteSchema.parse({ vote: "keep" })).toEqual({ vote: "keep" });
  });

  it("rejects 'remove' (no longer valid)", () => {
    expect(() => communityVoteSchema.parse({ vote: "remove" })).toThrow();
  });

  it("rejects 'delete' (uses different enum)", () => {
    expect(() => communityVoteSchema.parse({ vote: "delete" })).toThrow();
  });

  it("rejects invalid values", () => {
    expect(() => communityVoteSchema.parse({ vote: "maybe" })).toThrow();
  });

  it("rejects missing vote field", () => {
    expect(() => communityVoteSchema.parse({})).toThrow();
  });
});

describe("communityQuerySchema", () => {
  it("applies all defaults for empty input", () => {
    const result = communityQuerySchema.parse({});
    expect(result).toEqual({
      type: "all",
      sort: "least_keep",
      page: 1,
      limit: 20,
    });
  });

  it("accepts sort='oldest_unwatched'", () => {
    expect(communityQuerySchema.parse({ sort: "oldest_unwatched" }).sort).toBe("oldest_unwatched");
  });

  it("accepts sort='newest'", () => {
    expect(communityQuerySchema.parse({ sort: "newest" }).sort).toBe("newest");
  });

  it("accepts unvoted='true'", () => {
    expect(communityQuerySchema.parse({ unvoted: "true" }).unvoted).toBe("true");
  });

  it("accepts common sort values", () => {
    for (const sort of ["title_asc", "title_desc", "requested_newest", "requested_oldest"]) {
      expect(communityQuerySchema.parse({ sort }).sort).toBe(sort);
    }
  });

  it("rejects invalid sort value", () => {
    expect(() => communityQuerySchema.parse({ sort: "alphabetical" })).toThrow();
  });

  it("coerces string page to number", () => {
    expect(communityQuerySchema.parse({ page: "2" }).page).toBe(2);
  });

  it("rejects limit > 100", () => {
    expect(() => communityQuerySchema.parse({ limit: "101" })).toThrow();
  });
});

describe("reviewRoundCreateSchema", () => {
  it("accepts valid name", () => {
    expect(reviewRoundCreateSchema.parse({ name: "February Review" })).toEqual({
      name: "February Review",
    });
  });

  it("rejects empty name", () => {
    expect(() => reviewRoundCreateSchema.parse({ name: "" })).toThrow();
  });

  it("rejects name over 100 chars", () => {
    expect(() => reviewRoundCreateSchema.parse({ name: "a".repeat(101) })).toThrow();
  });

  it("rejects missing name", () => {
    expect(() => reviewRoundCreateSchema.parse({})).toThrow();
  });
});

describe("reviewActionSchema", () => {
  it("accepts 'remove' action", () => {
    const result = reviewActionSchema.parse({ mediaItemId: "1", action: "remove" });
    expect(result.action).toBe("remove");
    expect(result.mediaItemId).toBe(1);
  });

  it("accepts 'keep' action", () => {
    expect(reviewActionSchema.parse({ mediaItemId: 2, action: "keep" }).action).toBe("keep");
  });

  it("accepts 'skip' action", () => {
    expect(reviewActionSchema.parse({ mediaItemId: 3, action: "skip" }).action).toBe("skip");
  });

  it("coerces string mediaItemId to number", () => {
    expect(reviewActionSchema.parse({ mediaItemId: "5", action: "keep" }).mediaItemId).toBe(5);
  });

  it("rejects invalid action", () => {
    expect(() => reviewActionSchema.parse({ mediaItemId: 1, action: "delete" })).toThrow();
  });

  it("rejects negative mediaItemId", () => {
    expect(() => reviewActionSchema.parse({ mediaItemId: -1, action: "keep" })).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { sortCandidates, type RoundCandidate } from "../ReviewRoundPanel";

const candidate = (
  overrides: Partial<RoundCandidate> & Pick<RoundCandidate, "id">
): RoundCandidate => ({
  title: "Untitled",
  mediaType: "movie",
  status: "available",
  posterPath: null,
  requestedByUsername: "user",
  nominatedBy: [],
  seasonCount: null,
  availableSeasonCount: null,
  nominationType: "delete",
  keepSeasons: null,
  tally: { keepCount: 0, keepVoters: [] },
  action: null,
  tmdbId: null,
  tvdbId: null,
  overseerrId: null,
  imdbId: null,
  ...overrides,
});

const candidates: RoundCandidate[] = [
  candidate({ id: 1, title: "Charlie", mediaType: "tv", tally: { keepCount: 5, keepVoters: [] } }),
  candidate({ id: 2, title: "Alpha", mediaType: "movie", tally: { keepCount: 2, keepVoters: [] } }),
  candidate({ id: 3, title: "Bravo", mediaType: "tv", tally: { keepCount: 8, keepVoters: [] } }),
];

const ids = (sorted: RoundCandidate[]) => sorted.map((c) => c.id);

describe("sortCandidates", () => {
  it("sorts by keep votes ascending", () => {
    expect(ids(sortCandidates(candidates, "votes_asc"))).toEqual([2, 1, 3]);
  });

  it("sorts by keep votes descending", () => {
    expect(ids(sortCandidates(candidates, "votes_desc"))).toEqual([3, 1, 2]);
  });

  it("sorts by title A-Z", () => {
    expect(ids(sortCandidates(candidates, "title_asc"))).toEqual([2, 3, 1]);
  });

  it("sorts by title Z-A", () => {
    expect(ids(sortCandidates(candidates, "title_desc"))).toEqual([1, 3, 2]);
  });

  it("sorts movies before TV", () => {
    expect(ids(sortCandidates(candidates, "type_movie"))).toEqual([2, 1, 3]);
  });

  it("sorts TV before movies", () => {
    expect(ids(sortCandidates(candidates, "type_tv"))).toEqual([1, 3, 2]);
  });

  it("does not mutate the original array", () => {
    const original = [...candidates];
    sortCandidates(candidates, "title_asc");
    expect(candidates).toEqual(original);
  });
});

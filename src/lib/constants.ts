import { COMMON_SORTS, type CommonSort } from "@/lib/db/sorting";

export const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-900/50 text-green-300",
  partial: "bg-yellow-900/50 text-yellow-300",
  processing: "bg-blue-900/50 text-blue-300",
  pending: "bg-orange-900/50 text-orange-300",
  unknown: "bg-gray-800 text-gray-400",
  removed: "bg-red-900/50 text-red-300 line-through",
};

export const VOTE_COLORS: Record<string, string> = {
  delete: "bg-red-900/50 text-red-300",
  trim: "bg-amber-900/50 text-amber-300",
};

export const VOTE_LABELS: Record<string, string> = {
  delete: "Nominated",
  trim: "Trim Seasons",
  nominated: "Nominated",
  none: "Not Nominated",
  watched: "Watched",
};

export const SORT_LABELS: Record<CommonSort, string> = {
  title_asc: "Title (A-Z)",
  title_desc: "Title (Z-A)",
  requested_newest: "Date Requested (Newest)",
  requested_oldest: "Date Requested (Oldest)",
};

export const COMMUNITY_SORTS = [
  "least_keep",
  "most_keep",
  "oldest_unwatched",
  "newest",
  ...COMMON_SORTS,
] as const;
export type CommunitySort = (typeof COMMUNITY_SORTS)[number];

export const COMMUNITY_SORT_LABELS: Record<CommunitySort, string> = {
  least_keep: "Fewest Keep Votes",
  most_keep: "Most Keep Votes",
  oldest_unwatched: "Oldest Unwatched",
  newest: "Recently Nominated",
  ...SORT_LABELS,
};

export const REVIEW_SORTS = [
  "votes_asc",
  "votes_desc",
  "title_asc",
  "title_desc",
  "type_movie",
  "type_tv",
] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEW_SORT_LABELS: Record<ReviewSort, string> = {
  votes_asc: "Keep Votes (Fewest)",
  votes_desc: "Keep Votes (Most)",
  title_asc: "Title (A-Z)",
  title_desc: "Title (Z-A)",
  type_movie: "Type (Movies First)",
  type_tv: "Type (TV First)",
};

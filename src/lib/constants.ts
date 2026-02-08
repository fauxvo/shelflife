export const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-900/50 text-green-300",
  partial: "bg-yellow-900/50 text-yellow-300",
  processing: "bg-blue-900/50 text-blue-300",
  pending: "bg-orange-900/50 text-orange-300",
  unknown: "bg-gray-800 text-gray-400",
  removed: "bg-red-900/50 text-red-300 line-through",
};

export const VOTE_COLORS: Record<string, string> = {
  keep: "bg-green-900/50 text-green-300",
  delete: "bg-red-900/50 text-red-300",
  trim: "bg-amber-900/50 text-amber-300",
};

export const VOTE_LABELS: Record<string, string> = {
  keep: "Keeping",
  delete: "Can Delete",
  trim: "Trim Seasons",
  none: "Not Voted",
  watched: "Watched",
};

export const COMMUNITY_VOTE_COLORS: Record<string, string> = {
  keep: "bg-green-600",
  remove: "bg-red-600",
};

export const SORT_LABELS: Record<string, string> = {
  title_asc: "Title (A-Z)",
  title_desc: "Title (Z-A)",
  requested_newest: "Date Requested (Newest)",
  requested_oldest: "Date Requested (Oldest)",
};

export const COMMUNITY_SORT_LABELS: Record<string, string> = {
  most_remove: "Most Votes to Remove",
  oldest_unwatched: "Oldest Unwatched",
  newest: "Recently Nominated",
  ...SORT_LABELS,
};

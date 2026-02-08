import { asc, desc, type SQL } from "drizzle-orm";
import { mediaItems } from "./schema";

export const COMMON_SORTS = [
  "title_asc",
  "title_desc",
  "requested_newest",
  "requested_oldest",
] as const;
export type CommonSort = (typeof COMMON_SORTS)[number];

/** Default sort used as fallback when no sort matches */
export const DEFAULT_SORT_ORDER = asc(mediaItems.title);

export function getCommonSortOrder(sortKey: string): SQL | null {
  switch (sortKey) {
    case "title_asc":
      return asc(mediaItems.title);
    case "title_desc":
      return desc(mediaItems.title);
    case "requested_newest":
      return desc(mediaItems.requestedAt);
    case "requested_oldest":
      return asc(mediaItems.requestedAt);
    default:
      return null;
  }
}

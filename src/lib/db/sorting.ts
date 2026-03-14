import { asc, desc, sql, type SQL } from "drizzle-orm";
import { mediaItems } from "./schema";

export const COMMON_SORTS = [
  "title_asc",
  "title_desc",
  "requested_newest",
  "requested_oldest",
  "added_newest",
  "added_oldest",
  "size_largest",
  "size_smallest",
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
    case "added_newest":
      return desc(mediaItems.addedAt);
    case "added_oldest":
      return asc(mediaItems.addedAt);
    case "size_largest":
      return sql`${mediaItems.fileSize} DESC NULLS LAST`;
    case "size_smallest":
      return sql`${mediaItems.fileSize} ASC NULLS LAST`;
    default:
      return null;
  }
}

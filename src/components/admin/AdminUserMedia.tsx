"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pagination } from "../ui/Pagination";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { ExternalLinks } from "../ui/ExternalLinks";
import { MediaCardSkeleton } from "../ui/MediaCardSkeleton";
import { VoteButton } from "../media/VoteButton";
import { STATUS_COLORS, VOTE_COLORS, VOTE_LABELS } from "@/lib/constants";
import type { MediaItemWithVote, VoteValue } from "@/types";

interface AdminUserMediaProps {
  plexId: string;
  statsFilter?: string | null;
}

export function AdminUserMedia({ plexId, statsFilter }: AdminUserMediaProps) {
  const router = useRouter();
  const [items, setItems] = useState<MediaItemWithVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filter, setFilter] = useState("all");

  // Reset page when statsFilter changes
  useEffect(() => {
    setPage(1);
  }, [statsFilter]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      // Apply stats filter override
      if (statsFilter === "nominated" || statsFilter === "none") {
        params.set("vote", statsFilter);
      }
      if (statsFilter === "watched") {
        params.set("watched", "true");
      }

      const res = await fetch(`/api/admin/users/${plexId}/requests?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotalPages(data.pagination.pages);
        setTotalItems(data.pagination.total);
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, [plexId, page, pageSize, statsFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Only apply local filter when no statsFilter is active
  const filtered = statsFilter
    ? items
    : filter === "all"
      ? items
      : filter === "none"
        ? items.filter((i) => !i.vote)
        : filter === "nominated"
          ? items.filter((i) => i.vote === "delete" || i.vote === "trim")
          : items;

  if (loading) {
    return <MediaCardSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        {!statsFilter &&
          ["all", "nominated", "none"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === f
                  ? "bg-[#e5a00d] font-medium text-black"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {f === "all" ? "All" : VOTE_LABELS[f] || f}
            </button>
          ))}
        {statsFilter && (
          <span className="text-sm text-[#e5a00d]">
            Filtered by: {VOTE_LABELS[statsFilter] || statsFilter}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p>No items match this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900"
            >
              <div className="relative aspect-[2/3] bg-gray-800">
                {item.posterPath ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w300${item.posterPath}`}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-600">
                    <svg
                      className="h-12 w-12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                      />
                    </svg>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <MediaTypeBadge mediaType={item.mediaType} />
                </div>
                {item.watchStatus?.watched && (
                  <div className="absolute top-2 right-2">
                    <span className="rounded bg-purple-900/80 px-2 py-0.5 text-xs text-purple-300">
                      Watched
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2 p-3">
                <h3 className="truncate text-sm font-medium" title={item.title}>
                  {item.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[item.status] || STATUS_COLORS.unknown}`}
                  >
                    {item.status}
                  </span>
                  {item.vote ? (
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${VOTE_COLORS[item.vote] || "bg-red-900/50 text-red-300"}`}
                    >
                      User: {VOTE_LABELS[item.vote] || "Nominated"}
                    </span>
                  ) : (
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                      User: Not nominated
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <p className="mb-1 text-xs text-gray-500">Your nomination:</p>
                  <VoteButton
                    mediaItemId={item.id}
                    currentVote={item.adminVote ?? null}
                    seasonCount={item.seasonCount}
                    mediaType={item.mediaType}
                    currentKeepSeasons={item.adminKeepSeasons ?? null}
                    onVoteChange={(newVote: VoteValue | null) => {
                      setItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, adminVote: newVote } : i))
                      );
                      router.refresh();
                    }}
                  />
                </div>
                {item.watchStatus && item.watchStatus.playCount > 0 && (
                  <p className="text-xs text-gray-500">
                    {item.watchStatus.playCount} play
                    {item.watchStatus.playCount !== 1 ? "s" : ""}
                  </p>
                )}
                <ExternalLinks
                  imdbId={item.imdbId}
                  tmdbId={item.tmdbId}
                  mediaType={item.mediaType}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

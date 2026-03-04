"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pagination } from "../ui/Pagination";
import { MediaCardSkeleton } from "../ui/MediaCardSkeleton";
import { BaseMediaCard } from "../ui/BaseMediaCard";
import { VoteButton } from "../media/VoteButton";
import { VOTE_COLORS, VOTE_LABELS } from "@/lib/constants";
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
  const [hasActiveRound, setHasActiveRound] = useState(false);

  // Check for active review round on mount
  useEffect(() => {
    fetch("/api/media/review-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHasActiveRound(!!data?.activeRound))
      .catch(() => {});
  }, []);

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
                  ? "bg-brand font-medium text-black"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {f === "all" ? "All" : VOTE_LABELS[f] || f}
            </button>
          ))}
        {statsFilter && (
          <span className="text-brand text-sm">
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
            <BaseMediaCard
              key={item.id}
              title={item.title}
              mediaType={item.mediaType}
              posterPath={item.posterPath}
              status={item.status}
              tmdbId={item.tmdbId}
              tvdbId={item.tvdbId}
              imdbId={item.imdbId}
              overseerrId={item.overseerrId}
              seasonCount={item.seasonCount}
              availableSeasonCount={item.availableSeasonCount}
              watchStatus={item.watchStatus}
              fileSize={item.fileSize}
            >
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
              {hasActiveRound && (
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
              )}
            </BaseMediaCard>
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

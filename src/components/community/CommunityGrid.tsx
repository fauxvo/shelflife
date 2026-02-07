"use client";

import { useState, useEffect, useCallback } from "react";
import { CommunityCard } from "./CommunityCard";
import { Pagination } from "../ui/Pagination";
import { MediaCardSkeleton } from "../ui/MediaCardSkeleton";
import { COMMUNITY_SORT_LABELS } from "@/lib/constants";
import type { CommunityCandidate, CommunityVoteValue } from "@/types";

export function CommunityGrid() {
  const [items, setItems] = useState<CommunityCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({
    type: "all",
    sort: "most_remove",
    unvoted: "",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        type: filters.type,
        sort: filters.sort,
      });
      if (filters.unvoted === "true") {
        params.set("unvoted", "true");
      }

      const res = await fetch(`/api/community?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotalPages(data.pagination.pages);
        setTotalItems(data.pagination.total);
      }
    } catch (error) {
      console.error("Failed to fetch community items:", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleVoteChange = (
    itemId: number,
    _vote: CommunityVoteValue | null,
    delta: { keep: number; remove: number }
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              currentUserVote: _vote,
              tally: {
                keepCount: item.tally.keepCount + delta.keep,
                removeCount: item.tally.removeCount + delta.remove,
              },
            }
          : item
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.type}
          onChange={(e) => {
            setFilters((f) => ({ ...f, type: e.target.value }));
            setPage(1);
          }}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Types</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>
        <select
          value={filters.sort}
          onChange={(e) => {
            setFilters((f) => ({ ...f, sort: e.target.value }));
            setPage(1);
          }}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          {Object.entries(COMMUNITY_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={filters.unvoted === "true"}
            onChange={(e) => {
              setFilters((f) => ({ ...f, unvoted: e.target.checked ? "true" : "" }));
              setPage(1);
            }}
            className="rounded border-gray-600 bg-gray-800"
          />
          Show only unvoted
        </label>
      </div>

      {/* Grid */}
      {loading ? (
        <MediaCardSkeleton />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-lg">Nothing up for review yet</p>
          <p className="mt-1 text-sm">Head to My Content to nominate items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <CommunityCard key={item.id} item={item} onVoteChange={handleVoteChange} />
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

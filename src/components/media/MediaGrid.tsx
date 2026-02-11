"use client";

import { useState, useEffect, useCallback } from "react";
import { MediaCard } from "./MediaCard";
import { Pagination } from "../ui/Pagination";
import { MediaCardSkeleton } from "../ui/MediaCardSkeleton";
import { VOTE_LABELS, SORT_LABELS } from "@/lib/constants";
import type { MediaItemWithVote, VoteValue } from "@/types";

interface MediaGridProps {
  initialItems?: MediaItemWithVote[];
  statsFilter?: string | null;
  onVoteChange?: (itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => void;
  onScopeChange?: (scope: string) => void;
}

export function MediaGrid({
  initialItems,
  statsFilter,
  onVoteChange,
  onScopeChange,
}: MediaGridProps) {
  const [items, setItems] = useState<MediaItemWithVote[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [fetchError, setFetchError] = useState(false);
  const [filters, setFilters] = useState({
    scope: "personal",
    type: "all",
    status: "all",
    vote: "all",
    sort: "requested_newest",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Reset page when statsFilter changes
  useEffect(() => {
    setPage(1);
  }, [statsFilter]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        scope: filters.scope,
        type: filters.type,
        status: filters.status,
        vote: filters.vote,
        sort: filters.sort,
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      // Apply stats filter override
      if (statsFilter === "nominated" || statsFilter === "none") {
        params.set("vote", statsFilter);
      }
      if (statsFilter === "watched") {
        params.set("watched", "true");
      }

      const res = await fetch(`/api/media?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotalPages(data.pagination.pages);
        setTotalItems(data.pagination.total);
      }
    } catch (err) {
      console.error("Failed to fetch media items:", err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, statsFilter, debouncedSearch, refreshKey]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleVoteChange = useCallback(
    (itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => {
      onVoteChange?.(itemId, oldVote, newVote);
      if (statsFilter) {
        setRefreshKey((k) => k + 1);
      }
    },
    [onVoteChange, statsFilter]
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.scope}
          onChange={(e) => {
            const newScope = e.target.value;
            setFilters((f) => ({ ...f, scope: newScope }));
            setPage(1);
            onScopeChange?.(newScope);
          }}
          aria-label="Content scope"
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Users</option>
          <option value="personal">My Requests</option>
        </select>
        <input
          type="text"
          placeholder="Search titles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-48 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500"
        />
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
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="partial">Partial</option>
          <option value="removed">Removed</option>
        </select>
        {!statsFilter && (
          <select
            value={filters.vote}
            onChange={(e) => {
              setFilters((f) => ({ ...f, vote: e.target.value }));
              setPage(1);
            }}
            className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
          >
            <option value="all">All</option>
            <option value="nominated">Nominated</option>
            <option value="none">Not Nominated</option>
          </select>
        )}
        <select
          value={filters.sort}
          onChange={(e) => {
            setFilters((f) => ({ ...f, sort: e.target.value }));
            setPage(1);
          }}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {statsFilter && (
          <span className="flex items-center text-sm text-[#e5a00d]">
            Filtered by: {VOTE_LABELS[statsFilter] || statsFilter}
          </span>
        )}
      </div>

      {/* Grid */}
      {fetchError ? (
        <div className="py-12 text-center text-red-400">
          <p className="text-lg">Failed to load media items</p>
          <button
            onClick={fetchItems}
            className="mt-2 text-sm text-gray-400 underline hover:text-gray-200"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <MediaCardSkeleton />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-lg">No media items found</p>
          <p className="mt-1 text-sm">
            {filters.scope === "personal"
              ? "Your requests will appear here after a sync"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onVoteChange={handleVoteChange} />
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

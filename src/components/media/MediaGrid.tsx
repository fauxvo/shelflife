"use client";

import { useState, useEffect, useCallback } from "react";
import { MediaCard } from "./MediaCard";
import { Pagination } from "../ui/Pagination";
import { MediaCardSkeleton } from "../ui/MediaCardSkeleton";
import { VOTE_LABELS } from "@/lib/constants";
import type { MediaItemWithVote } from "@/types";

interface MediaGridProps {
  initialItems?: MediaItemWithVote[];
  statsFilter?: string | null;
}

export function MediaGrid({ initialItems, statsFilter }: MediaGridProps) {
  const [items, setItems] = useState<MediaItemWithVote[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    vote: "all",
  });

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
        type: filters.type,
        status: filters.status,
        vote: filters.vote,
      });

      // Apply stats filter override
      if (statsFilter === "keep" || statsFilter === "delete" || statsFilter === "none") {
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
    } catch {
      // Keep existing items
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, statsFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
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
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="partial">Partial</option>
        </select>
        {!statsFilter && (
          <select
            value={filters.vote}
            onChange={(e) => {
              setFilters((f) => ({ ...f, vote: e.target.value }));
              setPage(1);
            }}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
          >
            <option value="all">All Votes</option>
            <option value="keep">Keeping</option>
            <option value="delete">Can Delete</option>
            <option value="none">Not Voted</option>
          </select>
        )}
        {statsFilter && (
          <span className="flex items-center text-sm text-[#e5a00d]">
            Filtered by: {VOTE_LABELS[statsFilter] || statsFilter}
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <MediaCardSkeleton />
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No media items found</p>
          <p className="text-sm mt-1">Your requests will appear here after a sync</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
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

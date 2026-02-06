"use client";

import { useState, useEffect } from "react";
import { MediaCard } from "./MediaCard";
import type { MediaItemWithVote } from "@/types";

interface MediaGridProps {
  initialItems?: MediaItemWithVote[];
}

export function MediaGrid({ initialItems }: MediaGridProps) {
  const [items, setItems] = useState<MediaItemWithVote[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    vote: "all",
  });

  useEffect(() => {
    fetchItems();
  }, [page, filters]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        type: filters.type,
        status: filters.status,
        vote: filters.vote,
      });
      const res = await fetch(`/api/media?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotalPages(data.pagination.pages);
      }
    } catch {
      // Keep existing items
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.type}
          onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Types</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="partial">Partial</option>
        </select>
        <select
          value={filters.vote}
          onChange={(e) => { setFilters((f) => ({ ...f, vote: e.target.value })); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">All Votes</option>
          <option value="keep">Keeping</option>
          <option value="delete">Can Delete</option>
          <option value="none">Not Voted</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 animate-pulse">
              <div className="aspect-[2/3] bg-gray-800" />
              <div className="p-3 space-y-3">
                <div className="h-4 bg-gray-800 rounded" />
                <div className="h-8 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
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
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 rounded-md text-sm disabled:opacity-50 hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-800 rounded-md text-sm disabled:opacity-50 hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

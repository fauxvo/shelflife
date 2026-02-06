"use client";

import { useState, useEffect, useCallback } from "react";
import { Pagination } from "../ui/Pagination";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import type { DeletionCandidate } from "@/types";

export function DeletionCandidates() {
  const [candidates, setCandidates] = useState<DeletionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/candidates?page=${page}&limit=${pageSize}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates);
        setTotalPages(data.pagination.pages);
        setTotalItems(data.pagination.total);
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-4 border border-gray-800 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No deletion candidates yet</p>
        <p className="text-sm mt-1">
          Items appear here when users vote to delete their own requests
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-3 pr-4">Title</th>
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Requested By</th>
              <th className="pb-3 pr-4">Watched</th>
              <th className="pb-3 pr-4">Plays</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {candidates.map((c) => (
              <tr key={c.id} className="text-gray-200">
                <td className="py-3 pr-4 font-medium">{c.title}</td>
                <td className="py-3 pr-4">
                  <MediaTypeBadge mediaType={c.mediaType} />
                </td>
                <td className="py-3 pr-4 text-gray-400">{c.requestedByUsername}</td>
                <td className="py-3 pr-4">
                  {c.watched ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-gray-500">No</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-gray-400">{c.playCount}</td>
                <td className="py-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-300">
                    Can Delete
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

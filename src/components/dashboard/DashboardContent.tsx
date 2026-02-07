"use client";

import { useState, useCallback } from "react";
import { UserStats } from "./UserStats";
import { MediaGrid } from "../media/MediaGrid";
import type { VoteValue } from "@/types";

interface DashboardContentProps {
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  trimCount: number;
  unvotedCount: number;
  watchedCount: number;
}

export function DashboardContent({
  totalRequests,
  keepCount: initialKeep,
  deleteCount: initialDelete,
  trimCount: initialTrim,
  unvotedCount: initialUnvoted,
  watchedCount,
}: DashboardContentProps) {
  const [statsFilter, setStatsFilter] = useState<string | null>(null);
  const [stats, setStats] = useState({
    keep: initialKeep,
    delete: initialDelete,
    trim: initialTrim,
    unvoted: initialUnvoted,
  });

  const handleVoteChange = useCallback(
    (_itemId: number, oldVote: VoteValue | null, newVote: VoteValue) => {
      setStats((prev) => {
        const next = { ...prev };

        // Decrement old bucket
        if (oldVote === "keep") next.keep--;
        else if (oldVote === "delete") next.delete--;
        else if (oldVote === "trim") next.trim--;
        else next.unvoted--; // was null (unvoted)

        // Increment new bucket
        if (newVote === "keep") next.keep++;
        else if (newVote === "delete") next.delete++;
        else if (newVote === "trim") next.trim++;

        return next;
      });
    },
    []
  );

  return (
    <>
      <UserStats
        totalRequests={totalRequests}
        keepCount={stats.keep}
        deleteCount={stats.delete}
        trimCount={stats.trim}
        unvotedCount={stats.unvoted}
        watchedCount={watchedCount}
        activeFilter={statsFilter}
        onFilterChange={setStatsFilter}
      />
      <div>
        <h2 className="mb-4 text-lg font-semibold">Your Requests</h2>
        <MediaGrid statsFilter={statsFilter} onVoteChange={handleVoteChange} />
      </div>
    </>
  );
}

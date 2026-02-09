"use client";

import { useState, useCallback } from "react";
import { UserStats } from "./UserStats";
import { MediaGrid } from "../media/MediaGrid";
import type { VoteValue } from "@/types";

interface DashboardContentProps {
  totalRequests: number;
  nominatedCount: number;
  notNominatedCount: number;
  watchedCount: number;
}

export function DashboardContent({
  totalRequests,
  nominatedCount: initialNominated,
  notNominatedCount: initialNotNominated,
  watchedCount,
}: DashboardContentProps) {
  const [statsFilter, setStatsFilter] = useState<string | null>(null);
  const [stats, setStats] = useState({
    nominated: initialNominated,
    notNominated: initialNotNominated,
  });

  const handleVoteChange = useCallback(
    (_itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => {
      setStats((prev) => {
        const next = { ...prev };
        const wasNominated = oldVote === "delete" || oldVote === "trim";
        const isNominated = newVote === "delete" || newVote === "trim";

        if (wasNominated && !isNominated) {
          // Un-nominating
          next.nominated--;
          next.notNominated++;
        } else if (!wasNominated && isNominated) {
          // Nominating
          next.nominated++;
          next.notNominated--;
        }
        // delete -> trim or trim -> delete: no stat change

        return next;
      });
    },
    []
  );

  return (
    <>
      <UserStats
        totalRequests={totalRequests}
        nominatedCount={stats.nominated}
        notNominatedCount={stats.notNominated}
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

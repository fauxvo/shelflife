"use client";

import { useState, useCallback, useRef } from "react";
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
  totalRequests: initialTotal,
  nominatedCount: initialNominated,
  notNominatedCount: initialNotNominated,
  watchedCount: initialWatched,
}: DashboardContentProps) {
  const [statsFilter, setStatsFilter] = useState<string | null>(null);
  const [scope, setScope] = useState("personal");
  const [stats, setStats] = useState({
    total: initialTotal,
    nominated: initialNominated,
    notNominated: initialNotNominated,
    watched: initialWatched,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const statsVersionRef = useRef(0);

  const fetchStats = useCallback(async (newScope: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const versionAtStart = statsVersionRef.current;

    try {
      const res = await fetch(`/api/media/stats?scope=${newScope}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        // Only apply if no votes occurred during the fetch
        if (statsVersionRef.current === versionAtStart) {
          setStats({
            total: data.total,
            nominated: data.nominated,
            notNominated: data.notNominated,
            watched: data.watched,
          });
        }
      }
    } catch {
      // Keep existing stats on error (including abort)
    }
  }, []);

  const handleScopeChange = useCallback(
    (newScope: string) => {
      setScope(newScope);
      setStatsFilter(null);
      fetchStats(newScope);
    },
    [fetchStats]
  );

  const handleVoteChange = useCallback(
    (_itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => {
      statsVersionRef.current++;
      setStats((prev) => {
        const next = { ...prev };
        const wasNominated = oldVote === "delete" || oldVote === "trim";
        const isNominated = newVote === "delete" || newVote === "trim";

        if (wasNominated && !isNominated) {
          next.nominated--;
          next.notNominated++;
        } else if (!wasNominated && isNominated) {
          next.nominated++;
          next.notNominated--;
        }

        return next;
      });
    },
    []
  );

  return (
    <>
      <UserStats
        totalRequests={stats.total}
        nominatedCount={stats.nominated}
        notNominatedCount={stats.notNominated}
        watchedCount={stats.watched}
        activeFilter={statsFilter}
        onFilterChange={setStatsFilter}
      />
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {scope === "personal" ? "Your Requests" : "All Users\u2019 Requests"}
        </h2>
        <MediaGrid
          statsFilter={statsFilter}
          onVoteChange={handleVoteChange}
          onScopeChange={handleScopeChange}
        />
      </div>
    </>
  );
}

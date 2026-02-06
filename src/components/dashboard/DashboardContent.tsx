"use client";

import { useState } from "react";
import { UserStats } from "./UserStats";
import { MediaGrid } from "../media/MediaGrid";

interface DashboardContentProps {
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  unvotedCount: number;
  watchedCount: number;
}

export function DashboardContent({
  totalRequests,
  keepCount,
  deleteCount,
  unvotedCount,
  watchedCount,
}: DashboardContentProps) {
  const [statsFilter, setStatsFilter] = useState<string | null>(null);

  return (
    <>
      <UserStats
        totalRequests={totalRequests}
        keepCount={keepCount}
        deleteCount={deleteCount}
        unvotedCount={unvotedCount}
        watchedCount={watchedCount}
        activeFilter={statsFilter}
        onFilterChange={setStatsFilter}
      />
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Requests</h2>
        <MediaGrid statsFilter={statsFilter} />
      </div>
    </>
  );
}

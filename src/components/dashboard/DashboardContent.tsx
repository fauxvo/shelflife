"use client";

import { useState } from "react";
import { UserStats } from "./UserStats";
import { MediaGrid } from "../media/MediaGrid";

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
  keepCount,
  deleteCount,
  trimCount,
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
        trimCount={trimCount}
        unvotedCount={unvotedCount}
        watchedCount={watchedCount}
        activeFilter={statsFilter}
        onFilterChange={setStatsFilter}
      />
      <div>
        <h2 className="mb-4 text-lg font-semibold">Your Requests</h2>
        <MediaGrid statsFilter={statsFilter} />
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { UserStats } from "../dashboard/UserStats";
import { AdminUserMedia } from "./AdminUserMedia";

interface AdminUserContentProps {
  plexId: string;
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  trimCount: number;
  unvotedCount: number;
  watchedCount: number;
}

export function AdminUserContent({
  plexId,
  totalRequests,
  keepCount,
  deleteCount,
  trimCount,
  unvotedCount,
  watchedCount,
}: AdminUserContentProps) {
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
        <h2 className="mb-4 text-lg font-semibold">Requests</h2>
        <AdminUserMedia plexId={plexId} statsFilter={statsFilter} />
      </div>
    </>
  );
}

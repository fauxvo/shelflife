"use client";

import { useState } from "react";
import { UserStats } from "../dashboard/UserStats";
import { AdminUserMedia } from "./AdminUserMedia";

interface AdminUserContentProps {
  plexId: string;
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  unvotedCount: number;
  watchedCount: number;
}

export function AdminUserContent({
  plexId,
  totalRequests,
  keepCount,
  deleteCount,
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
        unvotedCount={unvotedCount}
        watchedCount={watchedCount}
        activeFilter={statsFilter}
        onFilterChange={setStatsFilter}
      />
      <div>
        <h2 className="text-lg font-semibold mb-4">Requests</h2>
        <AdminUserMedia plexId={plexId} statsFilter={statsFilter} />
      </div>
    </>
  );
}

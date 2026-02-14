"use client";

import { useState } from "react";
import { UserStats } from "../dashboard/UserStats";
import { AdminUserMedia } from "./AdminUserMedia";

interface AdminUserContentProps {
  plexId: string;
  totalRequests: number;
  activeRequests: number;
  nominatedCount: number;
  notNominatedCount: number;
  watchedCount: number;
}

export function AdminUserContent({
  plexId,
  totalRequests,
  activeRequests,
  nominatedCount,
  notNominatedCount,
  watchedCount,
}: AdminUserContentProps) {
  const [statsFilter, setStatsFilter] = useState<string | null>(null);

  return (
    <>
      <UserStats
        totalRequests={totalRequests}
        activeRequests={activeRequests}
        nominatedCount={nominatedCount}
        notNominatedCount={notNominatedCount}
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

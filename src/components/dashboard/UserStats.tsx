"use client";

interface UserStatsProps {
  totalRequests: number;
  activeRequests?: number;
  nominatedCount: number;
  notNominatedCount: number;
  watchedCount: number;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
}

export function UserStats({
  totalRequests,
  activeRequests,
  nominatedCount,
  notNominatedCount,
  watchedCount,
  activeFilter,
  onFilterChange,
}: UserStatsProps) {
  const showActive = activeRequests !== undefined && activeRequests !== totalRequests;
  const stats = [
    ...(showActive
      ? [
          { label: "Active Requests", value: activeRequests, color: "text-gray-100", filter: null },
          { label: "Total Requests", value: totalRequests, color: "text-gray-400", filter: null },
        ]
      : [{ label: "Total Requests", value: totalRequests, color: "text-gray-100", filter: null }]),
    { label: "Nominated", value: nominatedCount, color: "text-red-400", filter: "nominated" },
    { label: "Not Nominated", value: notNominatedCount, color: "text-green-400", filter: "none" },
    { label: "Watched", value: watchedCount, color: "text-purple-400", filter: "watched" },
  ];

  return (
    <div className={`grid grid-cols-2 gap-4 ${showActive ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
      {stats.map((stat) => {
        const isActive = activeFilter === stat.filter;
        return (
          <button
            key={stat.label}
            onClick={() => onFilterChange?.(isActive ? null : stat.filter)}
            className={`rounded-lg border bg-gray-900 p-4 text-left transition-colors ${
              isActive
                ? "border-brand ring-brand/50 ring-1"
                : "border-gray-800 hover:border-gray-600"
            }`}
          >
            <p className="text-xs tracking-wide text-gray-500 uppercase">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </button>
        );
      })}
    </div>
  );
}

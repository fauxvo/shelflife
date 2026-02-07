"use client";

interface UserStatsProps {
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  trimCount: number;
  unvotedCount: number;
  watchedCount: number;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
}

export function UserStats({
  totalRequests,
  keepCount,
  deleteCount,
  trimCount,
  unvotedCount,
  watchedCount,
  activeFilter,
  onFilterChange,
}: UserStatsProps) {
  const stats = [
    { label: "Total Requests", value: totalRequests, color: "text-gray-100", filter: null },
    { label: "Keeping", value: keepCount, color: "text-green-400", filter: "keep" },
    { label: "Can Delete", value: deleteCount, color: "text-red-400", filter: "delete" },
    { label: "Trim Seasons", value: trimCount, color: "text-amber-400", filter: "trim" },
    { label: "Not Voted", value: unvotedCount, color: "text-yellow-400", filter: "none" },
    { label: "Watched", value: watchedCount, color: "text-purple-400", filter: "watched" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
      {stats.map((stat) => {
        const isActive = activeFilter === stat.filter;
        return (
          <button
            key={stat.label}
            onClick={() => onFilterChange?.(isActive ? null : stat.filter)}
            className={`rounded-lg border bg-gray-900 p-4 text-left transition-colors ${
              isActive
                ? "border-[#e5a00d] ring-1 ring-[#e5a00d]/50"
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

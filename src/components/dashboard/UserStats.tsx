"use client";

interface UserStatsProps {
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  unvotedCount: number;
  watchedCount: number;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
}

export function UserStats({
  totalRequests,
  keepCount,
  deleteCount,
  unvotedCount,
  watchedCount,
  activeFilter,
  onFilterChange,
}: UserStatsProps) {
  const stats = [
    { label: "Total Requests", value: totalRequests, color: "text-gray-100", filter: null },
    { label: "Keeping", value: keepCount, color: "text-green-400", filter: "keep" },
    { label: "Can Delete", value: deleteCount, color: "text-red-400", filter: "delete" },
    { label: "Not Voted", value: unvotedCount, color: "text-yellow-400", filter: "none" },
    { label: "Watched", value: watchedCount, color: "text-purple-400", filter: "watched" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const isActive = activeFilter === stat.filter;
        return (
          <button
            key={stat.label}
            onClick={() => onFilterChange?.(isActive ? null : stat.filter)}
            className={`bg-gray-900 rounded-lg p-4 border text-left transition-colors ${
              isActive
                ? "border-[#e5a00d] ring-1 ring-[#e5a00d]/50"
                : "border-gray-800 hover:border-gray-600"
            }`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </button>
        );
      })}
    </div>
  );
}

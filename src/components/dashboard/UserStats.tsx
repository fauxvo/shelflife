interface UserStatsProps {
  totalRequests: number;
  keepCount: number;
  deleteCount: number;
  unvotedCount: number;
  watchedCount: number;
}

export function UserStats({ totalRequests, keepCount, deleteCount, unvotedCount, watchedCount }: UserStatsProps) {
  const stats = [
    { label: "Total Requests", value: totalRequests, color: "text-gray-100" },
    { label: "Keeping", value: keepCount, color: "text-green-400" },
    { label: "Can Delete", value: deleteCount, color: "text-red-400" },
    { label: "Not Voted", value: unvotedCount, color: "text-yellow-400" },
    { label: "Watched", value: watchedCount, color: "text-purple-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
          <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

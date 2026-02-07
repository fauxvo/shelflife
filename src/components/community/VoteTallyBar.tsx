"use client";

interface VoteTallyBarProps {
  keepCount: number;
  removeCount: number;
}

export function VoteTallyBar({ keepCount, removeCount }: VoteTallyBarProps) {
  const total = keepCount + removeCount;

  if (total === 0) {
    return (
      <div>
        <div className="h-1.5 w-full rounded-full bg-gray-700" />
        <p className="mt-1 text-center text-xs text-gray-500">No votes yet</p>
      </div>
    );
  }

  const keepPct = (keepCount / total) * 100;
  const removePct = (removeCount / total) * 100;

  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full">
        {keepPct > 0 && <div className="bg-green-600" style={{ width: `${keepPct}%` }} />}
        {removePct > 0 && <div className="bg-red-600" style={{ width: `${removePct}%` }} />}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{keepCount} keep</span>
        <span>{removeCount} remove</span>
      </div>
    </div>
  );
}

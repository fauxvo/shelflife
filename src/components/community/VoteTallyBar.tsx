"use client";

interface VoteTallyBarProps {
  keepCount: number;
}

export function VoteTallyBar({ keepCount }: VoteTallyBarProps) {
  if (keepCount === 0) {
    return <p className="text-center text-xs text-gray-500">No votes yet</p>;
  }

  return (
    <p className="text-center text-xs text-green-400">
      {keepCount} vote{keepCount !== 1 ? "s" : ""} to keep
    </p>
  );
}

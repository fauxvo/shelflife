"use client";

import { useState } from "react";

interface VoteTallyBarProps {
  keepCount: number;
  /** When provided, clicking the tally reveals voter names (admin view) */
  keepVoters?: string[];
}

export function VoteTallyBar({ keepCount, keepVoters }: VoteTallyBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (keepCount === 0) {
    return <p className="text-center text-xs text-gray-500">No votes yet</p>;
  }

  const hasVoters = keepVoters && keepVoters.length > 0;

  return (
    <div className="text-center">
      {hasVoters ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-green-400 transition-colors hover:text-green-300"
          title="Click to see voters"
        >
          {keepCount} vote{keepCount !== 1 ? "s" : ""} to keep
        </button>
      ) : (
        <p className="text-xs text-green-400">
          {keepCount} vote{keepCount !== 1 ? "s" : ""} to keep
        </p>
      )}
      {expanded && hasVoters && (
        <div className="mt-1 text-xs text-gray-400">{keepVoters.join(", ")}</div>
      )}
    </div>
  );
}

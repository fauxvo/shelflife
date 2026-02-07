"use client";

import { CommunityGrid } from "./CommunityGrid";

interface CommunityContentProps {
  totalCandidates: number;
  totalVotes: number;
  activeRound: { name: string; startedAt: string } | null;
}

export function CommunityContent({
  totalCandidates,
  totalVotes,
  activeRound,
}: CommunityContentProps) {
  return (
    <div className="space-y-6">
      {activeRound && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <p className="text-sm font-medium text-green-400">
              Review Round Active: {activeRound.name}
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            An admin is currently reviewing community votes. Your votes count — make them now!
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs tracking-wide text-gray-500 uppercase">Up for Review</p>
          <p className="mt-1 text-2xl font-bold">{totalCandidates}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs tracking-wide text-gray-500 uppercase">Community Votes</p>
          <p className="mt-1 text-2xl font-bold">{totalVotes}</p>
        </div>
      </div>
      <CommunityGrid />
    </div>
  );
}

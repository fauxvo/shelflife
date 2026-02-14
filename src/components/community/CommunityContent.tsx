"use client";

import { useState, useCallback } from "react";
import { CommunityGrid } from "./CommunityGrid";
import { ReviewStatusBanner } from "../ui/ReviewStatusBanner";

interface CommunityContentProps {
  totalCandidates: number;
  totalVotes: number;
  activeRound: { name: string; startedAt: string; endDate: string | null } | null;
}

export function CommunityContent({
  totalCandidates: initialCandidates,
  totalVotes: initialVotes,
  activeRound,
}: CommunityContentProps) {
  const [stats, setStats] = useState({
    candidates: initialCandidates,
    votes: initialVotes,
  });

  const handleCandidateRemoved = useCallback(() => {
    setStats((prev) => ({ ...prev, candidates: prev.candidates - 1 }));
  }, []);

  const handleCommunityVoteChange = useCallback((delta: number) => {
    setStats((prev) => ({ ...prev, votes: prev.votes + delta }));
  }, []);

  return (
    <div className="space-y-6">
      <ReviewStatusBanner mode="voting" initialActiveRound={activeRound} />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs tracking-wide text-gray-500 uppercase">Up for Review</p>
          <p className="mt-1 text-2xl font-bold">{stats.candidates}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs tracking-wide text-gray-500 uppercase">Community Votes</p>
          <p className="mt-1 text-2xl font-bold">{stats.votes}</p>
        </div>
      </div>
      <CommunityGrid
        onCandidateRemoved={handleCandidateRemoved}
        onCommunityVoteChange={handleCommunityVoteChange}
      />
    </div>
  );
}

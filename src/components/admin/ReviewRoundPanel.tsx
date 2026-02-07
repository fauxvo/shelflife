"use client";

import { useState, useEffect, useCallback } from "react";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { VoteTallyBar } from "../community/VoteTallyBar";

interface RoundCandidate {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  status: string;
  requestedByUsername: string;
  seasonCount: number | null;
  nominationType: "delete" | "trim";
  keepSeasons: number | null;
  tally: { keepCount: number; removeCount: number };
  action: "remove" | "keep" | "skip" | null;
}

interface ActiveRound {
  id: number;
  name: string;
  status: string;
  startedAt: string;
}

interface ReviewRoundPanelProps {
  round: ActiveRound;
  onClosed: () => void;
}

export function ReviewRoundPanel({ round, onClosed }: ReviewRoundPanelProps) {
  const [candidates, setCandidates] = useState<RoundCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates);
      }
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setLoading(false);
    }
  }, [round.id]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleAction = async (mediaItemId: number, action: "remove" | "keep" | "skip") => {
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemId, action }),
      });
      if (res.ok) {
        setCandidates((prev) => prev.map((c) => (c.id === mediaItemId ? { ...c, action } : c)));
      }
    } catch (error) {
      console.error("Failed to record review action:", error);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}/close`, {
        method: "POST",
      });
      if (res.ok) {
        onClosed();
      }
    } catch (error) {
      console.error("Failed to close review round:", error);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{round.name}</h3>
          <p className="text-sm text-gray-400">
            Started {new Date(round.startedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={handleClose}
          disabled={closing}
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
        >
          {closing ? "Closing..." : "Close Round"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-800 bg-gray-800 p-4"
            >
              <div className="h-4 w-1/3 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No candidates to review</p>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-800/50 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{c.title}</span>
                  <MediaTypeBadge mediaType={c.mediaType} />
                </div>
                <p className="text-sm text-gray-400">by {c.requestedByUsername}</p>
                {c.nominationType === "trim" && c.keepSeasons && c.seasonCount && (
                  <p className="text-xs text-amber-400">
                    Trim to latest {c.keepSeasons} of {c.seasonCount} seasons
                  </p>
                )}
                <div className="mt-2 max-w-xs">
                  <VoteTallyBar keepCount={c.tally.keepCount} removeCount={c.tally.removeCount} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(c.id, "remove")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    c.action === "remove"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Remove
                </button>
                <button
                  onClick={() => handleAction(c.id, "keep")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    c.action === "keep"
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Keep
                </button>
                <button
                  onClick={() => handleAction(c.id, "skip")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    c.action === "skip"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

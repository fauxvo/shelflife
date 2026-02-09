"use client";

import { useState, useEffect } from "react";
import type { VoteValue } from "@/types";

interface VoteButtonProps {
  mediaItemId: number;
  currentVote: VoteValue | null;
  seasonCount?: number | null;
  mediaType?: "movie" | "tv";
  currentKeepSeasons?: number | null;
  onVoteChange?: (newVote: VoteValue | null, oldVote: VoteValue | null) => void;
}

export function VoteButton({
  mediaItemId,
  currentVote,
  seasonCount,
  mediaType,
  currentKeepSeasons,
  onVoteChange,
}: VoteButtonProps) {
  const [vote, setVote] = useState<VoteValue | null>(currentVote);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepSeasons, setKeepSeasons] = useState<number>(currentKeepSeasons || 1);
  const [showTrimSelector, setShowTrimSelector] = useState(false);

  useEffect(() => {
    setVote(currentVote);
  }, [currentVote]);

  useEffect(() => {
    if (currentKeepSeasons != null) {
      setKeepSeasons(currentKeepSeasons);
    }
  }, [currentKeepSeasons]);

  const canTrim = mediaType === "tv" && seasonCount && seasonCount > 1;
  const isNominated = vote === "delete" || vote === "trim";

  const handleNominate = async () => {
    if (isNominated) {
      // Un-nominate via DELETE
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/media/${mediaItemId}/vote`, {
          method: "DELETE",
        });
        if (res.ok) {
          const oldVote = vote;
          setVote(null);
          setShowTrimSelector(false);
          onVoteChange?.(null, oldVote);
        } else {
          const body = await res.json().catch(() => null);
          setError(body?.error || "Failed. Try again.");
        }
      } catch (err) {
        console.error("Failed to un-nominate:", err);
        setError("Failed. Try again.");
      } finally {
        setLoading(false);
      }
    } else {
      // Nominate for deletion via POST
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/media/${mediaItemId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote: "delete" }),
        });
        if (res.ok) {
          const oldVote = vote;
          setVote("delete");
          onVoteChange?.("delete", oldVote);
        } else {
          const body = await res.json().catch(() => null);
          setError(body?.error || "Failed. Try again.");
        }
      } catch (err) {
        console.error("Failed to nominate:", err);
        setError("Failed. Try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTrim = async (seasons: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${mediaItemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: "trim", keepSeasons: seasons }),
      });
      if (res.ok) {
        const oldVote = vote;
        setVote("trim");
        setKeepSeasons(seasons);
        setShowTrimSelector(false);
        onVoteChange?.("trim", oldVote);
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Failed. Try again.");
      }
    } catch (err) {
      console.error("Failed to set trim:", err);
      setError("Failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={handleNominate}
        disabled={loading}
        className={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          vote === "trim"
            ? "bg-amber-600 text-white"
            : vote === "delete"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
        } disabled:opacity-50`}
      >
        {vote === "trim"
          ? `Trim: keep latest ${keepSeasons} season${keepSeasons !== 1 ? "s" : ""}`
          : vote === "delete"
            ? "Nominated for Deletion"
            : "Nominate for Deletion"}
      </button>
      {canTrim && isNominated && (
        <>
          <button
            onClick={() => setShowTrimSelector(!showTrimSelector)}
            disabled={loading}
            className="w-full text-center text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
          >
            {vote === "trim" ? "Change trim settings" : "Trim seasons instead?"}
          </button>
          {showTrimSelector && (
            <div className="flex items-center gap-2 rounded-md bg-gray-800 p-2">
              <label className="text-xs whitespace-nowrap text-gray-400">Keep latest</label>
              <input
                type="number"
                min={1}
                max={seasonCount - 1}
                value={keepSeasons}
                onChange={(e) =>
                  setKeepSeasons(Math.max(1, Math.min(seasonCount - 1, Number(e.target.value))))
                }
                className="w-14 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-center text-sm text-gray-200"
              />
              <span className="text-xs text-gray-400">of {seasonCount}</span>
              <button
                onClick={() => handleTrim(keepSeasons)}
                disabled={loading}
                className="ml-auto rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

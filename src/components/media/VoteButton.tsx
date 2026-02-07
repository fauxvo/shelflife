"use client";

import { useState } from "react";
import type { VoteValue } from "@/types";

interface VoteButtonProps {
  mediaItemId: number;
  currentVote: VoteValue | null;
  seasonCount?: number | null;
  mediaType?: "movie" | "tv";
  currentKeepSeasons?: number | null;
  onVoteChange?: (vote: VoteValue) => void;
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
  const [keepSeasons, setKeepSeasons] = useState<number>(currentKeepSeasons || 1);
  const [showTrimSelector, setShowTrimSelector] = useState(false);

  const canTrim = mediaType === "tv" && seasonCount && seasonCount > 1;

  const handleVote = async (newVote: VoteValue, seasons?: number) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { vote: newVote };
      if (newVote === "trim" && seasons !== undefined) {
        body.keepSeasons = seasons;
      }

      const res = await fetch(`/api/media/${mediaItemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setVote(newVote);
        if (newVote === "trim" && seasons !== undefined) {
          setKeepSeasons(seasons);
        }
        setShowTrimSelector(false);
        onVoteChange?.(newVote);
      }
    } catch (error) {
      console.error("Failed to cast vote:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => handleVote("keep")}
          disabled={loading}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            vote === "keep"
              ? "bg-green-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          } disabled:opacity-50`}
        >
          Keep
        </button>
        <button
          onClick={() => handleVote("delete")}
          disabled={loading}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            vote === "delete"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          } disabled:opacity-50`}
        >
          Can Delete
        </button>
      </div>
      {canTrim && (
        <>
          <button
            onClick={() => setShowTrimSelector(!showTrimSelector)}
            disabled={loading}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              vote === "trim"
                ? "bg-amber-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            } disabled:opacity-50`}
          >
            {vote === "trim"
              ? `Trim: keep latest ${keepSeasons} season${keepSeasons !== 1 ? "s" : ""}`
              : "Trim Seasons"}
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
                onClick={() => handleVote("trim", keepSeasons)}
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

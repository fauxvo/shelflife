"use client";

import { useState } from "react";
import type { VoteValue } from "@/types";

interface VoteButtonProps {
  mediaItemId: number;
  currentVote: VoteValue | null;
  onVoteChange?: (vote: VoteValue) => void;
}

export function VoteButton({ mediaItemId, currentVote, onVoteChange }: VoteButtonProps) {
  const [vote, setVote] = useState<VoteValue | null>(currentVote);
  const [loading, setLoading] = useState(false);

  const handleVote = async (newVote: VoteValue) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/media/${mediaItemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: newVote }),
      });

      if (res.ok) {
        setVote(newVote);
        onVoteChange?.(newVote);
      }
    } catch {
      // Silently fail - vote will be out of sync
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleVote("keep")}
        disabled={loading}
        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
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
        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
          vote === "delete"
            ? "bg-red-600 text-white"
            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
        } disabled:opacity-50`}
      >
        Can Delete
      </button>
    </div>
  );
}

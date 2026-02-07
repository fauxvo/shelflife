"use client";

import { useState } from "react";
import type { CommunityVoteValue } from "@/types";

interface CommunityVoteButtonProps {
  mediaItemId: number;
  currentVote: CommunityVoteValue | null;
  onVoteChange?: (vote: CommunityVoteValue | null, delta: { keep: number; remove: number }) => void;
}

export function CommunityVoteButton({
  mediaItemId,
  currentVote,
  onVoteChange,
}: CommunityVoteButtonProps) {
  const [vote, setVote] = useState<CommunityVoteValue | null>(currentVote);
  const [loading, setLoading] = useState(false);

  const handleVote = async (newVote: CommunityVoteValue) => {
    setLoading(true);
    try {
      if (vote === newVote) {
        // Retract vote
        const res = await fetch(`/api/community/${mediaItemId}/vote`, {
          method: "DELETE",
        });
        if (res.ok) {
          const delta = { keep: 0, remove: 0 };
          if (vote === "keep") delta.keep = -1;
          if (vote === "remove") delta.remove = -1;
          setVote(null);
          onVoteChange?.(null, delta);
        }
      } else {
        // Cast or change vote
        const res = await fetch(`/api/community/${mediaItemId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote: newVote }),
        });
        if (res.ok) {
          const delta = { keep: 0, remove: 0 };
          // Remove old vote effect
          if (vote === "keep") delta.keep = -1;
          if (vote === "remove") delta.remove = -1;
          // Add new vote effect
          if (newVote === "keep") delta.keep += 1;
          if (newVote === "remove") delta.remove += 1;
          setVote(newVote);
          onVoteChange?.(newVote, delta);
        }
      }
    } catch (error) {
      console.error("Failed to cast community vote:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        onClick={() => handleVote("remove")}
        disabled={loading}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          vote === "remove"
            ? "bg-red-600 text-white"
            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
        } disabled:opacity-50`}
      >
        Remove
      </button>
    </div>
  );
}

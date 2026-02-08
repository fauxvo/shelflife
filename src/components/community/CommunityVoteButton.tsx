"use client";

import { useState } from "react";
import type { CommunityVoteValue } from "@/types";

interface CommunityVoteButtonProps {
  mediaItemId: number;
  currentVote: CommunityVoteValue | null;
  onVoteChange?: (vote: CommunityVoteValue | null, delta: { keep: number }) => void;
}

export function CommunityVoteButton({
  mediaItemId,
  currentVote,
  onVoteChange,
}: CommunityVoteButtonProps) {
  const [vote, setVote] = useState<CommunityVoteValue | null>(currentVote);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (vote === "keep") {
        // Retract vote
        const res = await fetch(`/api/community/${mediaItemId}/vote`, {
          method: "DELETE",
        });
        if (res.ok) {
          setVote(null);
          onVoteChange?.(null, { keep: -1 });
        }
      } else {
        // Cast keep vote
        const res = await fetch(`/api/community/${mediaItemId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote: "keep" }),
        });
        if (res.ok) {
          setVote("keep");
          onVoteChange?.("keep", { keep: 1 });
        }
      }
    } catch (error) {
      console.error("Failed to cast community vote:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        vote === "keep" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
      } disabled:opacity-50`}
    >
      {vote === "keep" ? "Voted to Keep" : "Vote to Keep"}
    </button>
  );
}

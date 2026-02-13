"use client";

import { useState, useEffect } from "react";

interface ActiveRound {
  id?: number;
  name: string;
  endDate: string | null;
}

interface ReviewStatusBannerProps {
  mode: "nominating" | "voting";
  initialActiveRound?: ActiveRound | null;
}

export function ReviewStatusBanner({ mode, initialActiveRound }: ReviewStatusBannerProps) {
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(initialActiveRound ?? null);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(!initialActiveRound);
  const [toggling, setToggling] = useState(false);

  const field = mode === "nominating" ? "nominations_complete" : "voting_complete";

  // Always fetch on mount to get the user's toggle state, even when
  // initialActiveRound provides round metadata from the server.
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/media/review-status");
        if (res.ok) {
          const data = await res.json();
          if (data.activeRound) {
            setActiveRound(data.activeRound);
            setComplete(
              mode === "nominating" ? data.status.nominationsComplete : data.status.votingComplete
            );
          } else {
            setActiveRound(null);
          }
        }
      } catch {
        // Keep existing state on error
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, [mode]);

  const handleToggle = async () => {
    const newValue = !complete;
    setComplete(newValue); // optimistic
    setToggling(true);

    try {
      const res = await fetch("/api/media/review-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: newValue }),
      });
      if (!res.ok) {
        setComplete(!newValue); // revert
      }
    } catch {
      setComplete(!newValue); // revert
    } finally {
      setToggling(false);
    }
  };

  if (loading || !activeRound) return null;

  const bannerText =
    mode === "nominating"
      ? "Nominate content you want removed."
      : "Vote to keep content nominated for removal.";

  const toggleLabel = mode === "nominating" ? "I\u2019m done nominating" : "I\u2019m done voting";

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <p className="text-sm font-medium text-green-400">
              Review Round Active: {activeRound.name}
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {bannerText}
            {activeRound.endDate && (
              <>
                {" "}
                Ends{" "}
                <span className="font-bold text-gray-200">
                  {new Date(activeRound.endDate).toLocaleDateString()}
                </span>{" "}
                — make your choices before it closes!
              </>
            )}
          </p>
        </div>
        <div className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-gray-400">{toggleLabel}</span>
          <button
            type="button"
            role="switch"
            aria-checked={complete}
            disabled={toggling}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              complete ? "bg-green-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                complete ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

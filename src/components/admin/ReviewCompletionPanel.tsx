"use client";

import { useState, useEffect } from "react";
import type { ReviewCompletionSummary } from "@/types";

interface ReviewCompletionPanelProps {
  roundId: number;
}

export function ReviewCompletionPanel({ roundId }: ReviewCompletionPanelProps) {
  const [data, setData] = useState<ReviewCompletionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchCompletion() {
      try {
        const res = await fetch(`/api/admin/review-rounds/${roundId}/completion`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Keep null state on error
      } finally {
        setLoading(false);
      }
    }

    fetchCompletion();
  }, [roundId]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <div className="h-4 w-48 rounded bg-gray-700" />
      </div>
    );
  }

  if (!data || data.totalParticipants === 0) return null;

  const nomPct = Math.round((data.nominationsComplete / data.totalParticipants) * 100);
  const votePct = Math.round((data.votingComplete / data.totalParticipants) * 100);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">User Completion</h4>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Nominating</span>
            <span className="text-xs font-medium text-gray-400">
              {data.nominationsComplete}/{data.totalParticipants}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${nomPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Voting</span>
            <span className="text-xs font-medium text-gray-400">
              {data.votingComplete}/{data.totalParticipants}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${votePct}%` }}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 overflow-hidden rounded-md border border-gray-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-3 py-2 font-medium text-gray-400">User</th>
                <th className="px-3 py-2 text-center font-medium text-gray-400">Nominating</th>
                <th className="px-3 py-2 text-center font-medium text-gray-400">Voting</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.username} className="border-b border-gray-800/50">
                  <td className="px-3 py-2 text-gray-300">{u.username}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        u.nominationsComplete ? "bg-green-500" : "bg-gray-600"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        u.votingComplete ? "bg-green-500" : "bg-gray-600"
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

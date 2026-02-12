"use client";

import { useState, useEffect, useCallback } from "react";
import { ReviewRoundPanel } from "./ReviewRoundPanel";

interface ReviewRound {
  id: number;
  name: string;
  status: string;
  startedAt: string;
  closedAt: string | null;
  endDate: string | null;
  actionCount: number;
}

export function ReviewRoundList() {
  const [rounds, setRounds] = useState<ReviewRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review-rounds");
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds);
      }
    } catch (error) {
      console.error("Failed to fetch review rounds:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/review-rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          ...(newEndDate ? { endDate: newEndDate } : {}),
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewEndDate("");
        fetchRounds();
      }
    } catch (error) {
      console.error("Failed to create review round:", error);
    } finally {
      setCreating(false);
    }
  };

  const activeRound = rounds.find((r) => r.status === "active");
  const closedRounds = rounds.filter((r) => r.status === "closed");

  return (
    <div className="space-y-6">
      {/* Active round */}
      {activeRound && <ReviewRoundPanel round={activeRound} onClosed={fetchRounds} />}

      {/* Start new round */}
      {!activeRound && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold">Start New Review Round</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Round name (e.g., February 2024 Review)"
              className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              maxLength={100}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
              title="End date (optional)"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="rounded-md bg-[#e5a00d] px-4 py-2 text-sm font-medium text-black hover:bg-[#c88b0a] disabled:opacity-50"
            >
              {creating ? "Creating..." : "Start Round"}
            </button>
          </div>
        </div>
      )}

      {/* Past rounds */}
      {closedRounds.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold">Past Review Rounds</h3>
          <div className="space-y-2">
            {closedRounds.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/50 p-3"
              >
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(r.startedAt).toLocaleDateString()} -{" "}
                    {r.closedAt ? new Date(r.closedAt).toLocaleDateString() : "Open"}
                    {r.endDate && ` (target: ${new Date(r.endDate).toLocaleDateString()})`}
                  </p>
                </div>
                <span className="text-sm text-gray-400">{r.actionCount} actions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && rounds.length === 0 && (
        <div className="animate-pulse rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="h-4 w-1/3 rounded bg-gray-800" />
        </div>
      )}
    </div>
  );
}

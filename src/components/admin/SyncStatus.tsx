"use client";

import { useState } from "react";

interface SyncStatusProps {
  lastSync?: {
    status: string;
    syncType: string;
    itemsSynced: number;
    completedAt: string | null;
  } | null;
}

export function SyncStatus({ lastSync }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const triggerSync = async (type: string) => {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(`Sync complete: ${JSON.stringify(data.synced)}`);
      } else {
        const err = await res.json();
        setResult(`Sync failed: ${err.error}`);
      }
    } catch (err) {
      setResult(`Sync error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
      <h3 className="text-lg font-semibold">Sync Status</h3>

      {lastSync && (
        <div className="text-sm text-gray-400 space-y-1">
          <p>
            Last sync: <span className="text-gray-200">{lastSync.syncType}</span> -{" "}
            <span className={lastSync.status === "completed" ? "text-green-400" : "text-red-400"}>
              {lastSync.status}
            </span>
          </p>
          <p>Items synced: {lastSync.itemsSynced}</p>
          {lastSync.completedAt && (
            <p>Completed: {new Date(lastSync.completedAt).toLocaleString()}</p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => triggerSync("full")}
          disabled={syncing}
          className="px-4 py-2 bg-[#e5a00d] hover:bg-[#cc8e0b] disabled:opacity-50 text-black font-medium rounded-md text-sm transition-colors"
        >
          {syncing ? "Syncing..." : "Full Sync"}
        </button>
        <button
          onClick={() => triggerSync("overseerr")}
          disabled={syncing}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-md text-sm transition-colors"
        >
          Overseerr Only
        </button>
        <button
          onClick={() => triggerSync("tautulli")}
          disabled={syncing}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-md text-sm transition-colors"
        >
          Tautulli Only
        </button>
      </div>

      {result && (
        <p className={`text-sm ${result.includes("failed") || result.includes("error") ? "text-red-400" : "text-green-400"}`}>
          {result}
        </p>
      )}
    </div>
  );
}

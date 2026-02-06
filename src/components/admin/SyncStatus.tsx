"use client";

import { useState, useRef } from "react";

interface SyncStatusProps {
  lastSync?: {
    status: string;
    syncType: string;
    itemsSynced: number;
    completedAt: string | null;
  } | null;
}

interface ProgressState {
  phase: string;
  step: string;
  current: number;
  total: number;
  detail?: string;
}

export function SyncStatus({ lastSync }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const triggerSync = async (type: string) => {
    setSyncing(true);
    setResult(null);
    setProgress(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/sync/stream?type=${type}`, {
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setResult(`Sync failed: ${err.error}`);
        setSyncing(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setResult("Sync failed: no response stream");
        setSyncing(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (currentEvent === "progress") {
              setProgress(data);
            } else if (currentEvent === "complete") {
              setResult(`Sync complete: ${JSON.stringify(data.synced)}`);
              setProgress(null);
            } else if (currentEvent === "error") {
              setResult(`Sync failed: ${data.message}`);
              setProgress(null);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setResult("Sync cancelled");
      } else {
        setResult(`Sync error: ${err instanceof Error ? err.message : "Unknown"}`);
      }
      setProgress(null);
    } finally {
      setSyncing(false);
      abortRef.current = null;
    }
  };

  const cancelSync = () => {
    abortRef.current?.abort();
  };

  const percentage =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
      <h3 className="text-lg font-semibold">Sync Status</h3>

      {lastSync && !syncing && (
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

      {/* Progress display */}
      {syncing && progress && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                progress.phase === "overseerr"
                  ? "bg-blue-900/50 text-blue-300"
                  : "bg-purple-900/50 text-purple-300"
              }`}
            >
              {progress.phase === "overseerr" ? "Overseerr" : "Tautulli"}
            </span>
            <span className="text-sm text-gray-300">{progress.step}</span>
          </div>

          {progress.total > 0 && (
            <div className="space-y-1">
              <div className="w-full bg-gray-800 rounded-full h-2.5">
                <div
                  className="bg-[#e5a00d] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {progress.current} / {progress.total}
                </span>
                <span>{percentage}%</span>
              </div>
            </div>
          )}

          {progress.detail && (
            <p className="text-xs text-gray-500 truncate">Last: {progress.detail}</p>
          )}
        </div>
      )}

      {syncing && !progress && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Starting sync...
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {syncing ? (
          <button
            onClick={cancelSync}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              onClick={() => triggerSync("full")}
              className="px-4 py-2 bg-[#e5a00d] hover:bg-[#cc8e0b] text-black font-medium rounded-md text-sm transition-colors"
            >
              Full Sync
            </button>
            <button
              onClick={() => triggerSync("overseerr")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm transition-colors"
            >
              Overseerr Only
            </button>
            <button
              onClick={() => triggerSync("tautulli")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm transition-colors"
            >
              Tautulli Only
            </button>
          </>
        )}
      </div>

      {result && (
        <p
          className={`text-sm ${result.includes("failed") || result.includes("error") ? "text-red-400" : "text-green-400"}`}
        >
          {result}
        </p>
      )}
    </div>
  );
}

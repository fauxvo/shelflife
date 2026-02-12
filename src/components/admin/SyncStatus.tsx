"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Toast, type ToastData } from "@/components/ui/Toast";

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

interface SyncResult {
  overseerr?: number;
  tautulli?: number;
}

export function formatSyncResult(synced: SyncResult): string {
  const parts: string[] = [];
  if (synced.overseerr != null) {
    parts.push(`${synced.overseerr} media item${synced.overseerr !== 1 ? "s" : ""}`);
  }
  if (synced.tautulli != null) {
    parts.push(`${synced.tautulli} watch record${synced.tautulli !== 1 ? "s" : ""}`);
  }
  if (parts.length === 0) return "Sync complete";
  return `Synced ${parts.join(" and ")}`;
}

export function SyncStatus({ lastSync }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const triggerSync = async (type: string) => {
    setSyncing(true);
    setToast(null);
    setProgress(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/sync/stream?type=${type}`, {
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setToast({ message: `Sync failed: ${err.error}`, type: "error" });
        setSyncing(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setToast({ message: "Sync failed: no response stream", type: "error" });
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
              setToast({
                message: formatSyncResult(data.synced),
                type: "success",
              });
              setProgress(null);
              router.refresh();
            } else if (currentEvent === "error") {
              setToast({ message: `Sync failed: ${data.message}`, type: "error" });
              setProgress(null);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setToast({ message: "Sync cancelled", type: "error" });
      } else {
        setToast({
          message: `Sync error: ${err instanceof Error ? err.message : "Unknown"}`,
          type: "error",
        });
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
    <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-lg font-semibold">Sync Status</h3>

      {lastSync && !syncing && (
        <div className="space-y-1 text-sm text-gray-400">
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
              className={`rounded px-2 py-0.5 text-xs font-medium ${
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
              <div className="h-2.5 w-full rounded-full bg-gray-800">
                <div
                  className="bg-brand h-2.5 rounded-full transition-all duration-300"
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
            <p className="truncate text-xs text-gray-500">Last: {progress.detail}</p>
          )}
        </div>
      )}

      {syncing && !progress && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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

      <div className="flex flex-wrap gap-2">
        {syncing ? (
          <button
            onClick={cancelSync}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-600"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              onClick={() => triggerSync("full")}
              className="bg-brand hover:bg-brand-hover rounded-md px-4 py-2 text-sm font-medium text-black transition-colors"
            >
              Full Sync
            </button>
            <button
              onClick={() => triggerSync("overseerr")}
              className="rounded-md bg-gray-700 px-4 py-2 text-sm transition-colors hover:bg-gray-600"
            >
              Overseerr Only
            </button>
            <button
              onClick={() => triggerSync("tautulli")}
              className="rounded-md bg-gray-700 px-4 py-2 text-sm transition-colors hover:bg-gray-600"
            >
              Tautulli Only
            </button>
          </>
        )}
      </div>

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

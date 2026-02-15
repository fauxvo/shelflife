"use client";

import { useState, useEffect, useCallback } from "react";
import type { ToastData } from "../ui/Toast";
import type { DeletionResult, DeletionServiceStatus } from "@/types";
import type { RoundCandidate } from "./ReviewRoundPanel";

interface UseDeletionOptions {
  roundId: number;
  candidates: RoundCandidate[];
  /** Ensure the "remove" action is recorded before executing deletion */
  onEnsureRemoveAction: (mediaItemId: number) => Promise<void>;
  /** Called after a successful deletion to update candidates state */
  onDeleted: (mediaItemId: number) => void;
}

export function useDeletion({
  roundId,
  candidates,
  onEnsureRemoveAction,
  onDeleted,
}: UseDeletionOptions) {
  const [serviceStatus, setServiceStatus] = useState<DeletionServiceStatus | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    fetch("/api/admin/services/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServiceStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleExecuteDeletion = useCallback(
    async (mediaItemId: number, deleteFiles: boolean) => {
      setDeletingId(mediaItemId);
      try {
        const candidate = candidates.find((c) => c.id === mediaItemId);
        if (candidate && candidate.action !== "remove") {
          await onEnsureRemoveAction(mediaItemId);
        }

        const res = await fetch(`/api/admin/review-rounds/${roundId}/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaItemId, deleteFiles }),
        });
        if (res.ok) {
          const result: DeletionResult = await res.json();
          onDeleted(mediaItemId);
          setConfirmDeleteId(null);

          const failures = [result.sonarr, result.radarr, result.overseerr].filter(
            (s) => s.attempted && !s.success
          );
          if (failures.length > 0) {
            setToast({
              type: "error",
              message:
                "Removed from library, but some services had errors. Check deletion log for details.",
            });
          }
        } else {
          const data = await res.json().catch(() => ({}));
          setToast({ type: "error", message: data.error || "Deletion failed" });
        }
      } catch (error) {
        console.error("Failed to execute deletion:", error);
        setToast({ type: "error", message: "Deletion failed — check console for details" });
      } finally {
        setDeletingId(null);
      }
    },
    [roundId, candidates, onEnsureRemoveAction, onDeleted]
  );

  return {
    serviceStatus,
    deletingId,
    confirmDeleteId,
    setConfirmDeleteId,
    toast,
    setToast,
    handleExecuteDeletion,
  };
}

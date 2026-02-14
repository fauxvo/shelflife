"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { VoteTallyBar } from "../community/VoteTallyBar";
import { ReviewCompletionPanel } from "./ReviewCompletionPanel";
import { DeletionConfirmDialog } from "./DeletionConfirmDialog";
import { REVIEW_SORT_LABELS } from "@/lib/constants";
import type { ReviewSort } from "@/lib/constants";
import type { DeletionServiceStatus, MediaStatus } from "@/types";

export interface RoundCandidate {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  status: MediaStatus;
  posterPath: string | null;
  requestedByUsername: string;
  nominatedBy: string[];
  seasonCount: number | null;
  availableSeasonCount: number | null;
  nominationType: "delete" | "trim";
  keepSeasons: number | null;
  tally: { keepCount: number };
  action: "remove" | "keep" | "skip" | null;
  tmdbId: number | null;
  tvdbId: number | null;
  overseerrId: number | null;
}

export function sortCandidates(candidates: RoundCandidate[], sort: ReviewSort): RoundCandidate[] {
  return [...candidates].sort((a, b) => {
    switch (sort) {
      case "votes_asc":
        return a.tally.keepCount - b.tally.keepCount;
      case "votes_desc":
        return b.tally.keepCount - a.tally.keepCount;
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "title_desc":
        return b.title.localeCompare(a.title);
      case "type_movie":
        return a.mediaType.localeCompare(b.mediaType);
      case "type_tv":
        return b.mediaType.localeCompare(a.mediaType);
    }
  });
}

interface ActiveRound {
  id: number;
  name: string;
  status: string;
  startedAt: string;
  endDate: string | null;
}

interface ReviewRoundPanelProps {
  round: ActiveRound;
  onClosed: () => void;
  onUpdated?: (round: ActiveRound) => void;
}

export function ReviewRoundPanel({ round, onClosed, onUpdated }: ReviewRoundPanelProps) {
  const [candidates, setCandidates] = useState<RoundCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("votes_asc");
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(round.name);
  const [serviceStatus, setServiceStatus] = useState<DeletionServiceStatus | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates);
      }
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setLoading(false);
    }
  }, [round.id]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    fetch("/api/admin/services/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServiceStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleAction = async (mediaItemId: number, action: "remove" | "keep" | "skip") => {
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemId, action }),
      });
      if (res.ok) {
        setCandidates((prev) => prev.map((c) => (c.id === mediaItemId ? { ...c, action } : c)));
      }
    } catch (error) {
      console.error("Failed to record review action:", error);
    }
  };

  const handleExecuteDeletion = async (mediaItemId: number, deleteFiles: boolean) => {
    setDeletingId(mediaItemId);
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemId, deleteFiles }),
      });
      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === mediaItemId ? { ...c, status: "removed" as const } : c))
        );
        setConfirmDeleteId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Deletion failed");
      }
    } catch (error) {
      console.error("Failed to execute deletion:", error);
      alert("Deletion failed — check console for details");
    } finally {
      setDeletingId(null);
    }
  };

  const sortedCandidates = useMemo(() => sortCandidates(candidates, sort), [candidates, sort]);

  const handleUpdate = async (fields: { name?: string; endDate?: string | null }) => {
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated?.(data.round);
      }
    } catch (error) {
      console.error("Failed to update review round:", error);
    }
  };

  const handleNameSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== round.name) {
      handleUpdate({ name: trimmed });
    }
    setEditingName(false);
  };

  const handleEndDateChange = (value: string) => {
    handleUpdate({ endDate: value || null });
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/admin/review-rounds/${round.id}/close`, {
        method: "POST",
      });
      if (res.ok) {
        onClosed();
      }
    } catch (error) {
      console.error("Failed to close review round:", error);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          {editingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                if (e.key === "Escape") {
                  setEditName(round.name);
                  setEditingName(false);
                }
              }}
              className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-lg font-semibold text-gray-200"
              maxLength={100}
              autoFocus
            />
          ) : (
            <h3
              className="hover:text-brand cursor-pointer text-lg font-semibold"
              onClick={() => {
                setEditName(round.name);
                setEditingName(true);
              }}
              title="Click to edit name"
            >
              {round.name}
            </h3>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Started {new Date(round.startedAt).toLocaleDateString()}</span>
            <span>·</span>
            <label className="flex items-center gap-1">
              Ends
              <input
                type="date"
                value={round.endDate ?? ""}
                onChange={(e) => handleEndDateChange(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-sm text-gray-200"
              />
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/admin/review-rounds/${round.id}/export`}
            download
            className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600"
          >
            Export CSV
          </a>
          <button
            onClick={handleClose}
            disabled={closing}
            className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
          >
            {closing ? "Closing..." : "Close Round"}
          </button>
        </div>
      </div>

      <ReviewCompletionPanel roundId={round.id} />

      {!loading && candidates.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ReviewSort)}
            className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
          >
            {Object.entries(REVIEW_SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-800 bg-gray-800 p-4"
            >
              <div className="h-4 w-1/3 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No candidates to review</p>
      ) : (
        <div className="space-y-3">
          {sortedCandidates.map((c) => (
            <div key={c.id}>
              <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-800/50 p-4">
                <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-gray-700">
                  {c.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w92${c.posterPath}`}
                      alt={c.title}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-500">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    <MediaTypeBadge mediaType={c.mediaType} />
                  </div>
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-500">Requested by</span> {c.requestedByUsername}
                    {c.nominatedBy.length > 0 && (
                      <>
                        <span className="mx-1.5 text-gray-600">·</span>
                        <span className="text-gray-500">Nominated by</span>{" "}
                        {c.nominatedBy.join(", ")}
                      </>
                    )}
                  </p>
                  {c.nominationType === "trim" && c.keepSeasons && c.seasonCount ? (
                    <p className="text-xs text-amber-400">
                      Trim to latest {c.keepSeasons} of {c.seasonCount} seasons
                    </p>
                  ) : c.mediaType === "tv" && c.seasonCount && c.seasonCount > 1 ? (
                    <p className="text-xs text-gray-500">
                      {c.availableSeasonCount && c.availableSeasonCount !== c.seasonCount
                        ? `${c.availableSeasonCount} of ${c.seasonCount} seasons`
                        : `${c.seasonCount} seasons`}
                    </p>
                  ) : null}
                  {c.status === "removed" ? (
                    <div className="mt-2 inline-block rounded bg-red-900/30 px-3 py-1 text-sm font-medium text-red-400">
                      Removed from library
                    </div>
                  ) : (
                    <div className="mt-2 text-left">
                      <VoteTallyBar keepCount={c.tally.keepCount} />
                    </div>
                  )}
                </div>
                {c.status !== "removed" && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(c.id, "remove")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          c.action === "remove"
                            ? "bg-red-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => handleAction(c.id, "keep")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          c.action === "keep"
                            ? "bg-green-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => handleAction(c.id, "skip")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          c.action === "skip"
                            ? "bg-yellow-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        Skip
                      </button>
                    </div>
                    {c.action === "remove" && serviceStatus && (
                      <div className="ml-2 border-l border-gray-700 pl-2">
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="rounded-md bg-red-900/50 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-red-400 hover:bg-red-900/70"
                        >
                          Execute Deletion
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {confirmDeleteId === c.id && serviceStatus && (
                <div className="mt-2">
                  <DeletionConfirmDialog
                    title={c.title}
                    mediaType={c.mediaType}
                    serviceStatus={serviceStatus}
                    onConfirm={(deleteFiles) => handleExecuteDeletion(c.id, deleteFiles)}
                    onCancel={() => setConfirmDeleteId(null)}
                    isDeleting={deletingId === c.id}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

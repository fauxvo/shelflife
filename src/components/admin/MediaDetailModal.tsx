"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";

interface MediaDetailModalProps {
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  seasonCount: number | null;
  availableSeasonCount: number | null;
  requestedByUsername: string;
  nominatedBy: string[];
  tmdbId: number | null;
  tvdbId: number | null;
  imdbId: string | null;
  overseerrId: number | null;
  onClose: () => void;
}

const ExternalLinkIcon = () => (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

export function MediaDetailModal({
  title,
  mediaType,
  posterPath,
  seasonCount,
  availableSeasonCount,
  requestedByUsername,
  nominatedBy,
  tmdbId,
  tvdbId,
  imdbId,
  overseerrId,
  onClose,
}: MediaDetailModalProps) {
  const tmdbType = mediaType === "tv" ? "tv" : "movie";
  const overseerrUrl = process.env.NEXT_PUBLIC_OVERSEERR_URL;
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(!!tmdbId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Fetch overview from Overseerr (via TMDB) on mount
  useEffect(() => {
    if (!tmdbId) return;
    fetch(`/api/admin/media/${tmdbId}/details?type=${tmdbType}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.overview) setOverview(data.overview);
      })
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, [tmdbId, tmdbType]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50 sm:flex-row">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-1.5 text-gray-400 transition-colors hover:bg-black/70 hover:text-white"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Poster */}
        <div className="relative aspect-[2/3] w-full flex-shrink-0 bg-gray-800 sm:w-48">
          {posterPath ? (
            <Image
              src={`https://image.tmdb.org/t/p/w400${posterPath}`}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 192px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-600">
              <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Details */}
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-1 flex items-center gap-2">
            <MediaTypeBadge mediaType={mediaType} />
          </div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>

          {/* Season info */}
          {mediaType === "tv" && seasonCount && seasonCount > 0 && (
            <p className="mt-1 text-sm text-gray-400">
              {availableSeasonCount && availableSeasonCount !== seasonCount
                ? `${availableSeasonCount} of ${seasonCount} seasons available`
                : `${seasonCount} season${seasonCount > 1 ? "s" : ""}`}
            </p>
          )}

          {/* Overview */}
          {overviewLoading ? (
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-gray-700" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-gray-700" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-gray-700" />
            </div>
          ) : overview ? (
            <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-gray-400">{overview}</p>
          ) : null}

          {/* Requested by */}
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>
                Requested by <span className="text-gray-200">{requestedByUsername}</span>
              </span>
            </div>
            {nominatedBy.length > 0 && (
              <div className="flex items-center gap-2 text-gray-400">
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                <span>
                  Nominated by <span className="text-gray-200">{nominatedBy.join(", ")}</span>
                </span>
              </div>
            )}
          </div>

          {/* External links */}
          <div className="mt-auto pt-5">
            <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
              View on
            </p>
            <div className="flex flex-wrap gap-2">
              {tmdbId && (
                <a
                  href={`https://www.themoviedb.org/${tmdbType}/${tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  TMDB
                  <ExternalLinkIcon />
                </a>
              )}
              {imdbId && (
                <a
                  href={`https://www.imdb.com/title/${imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  IMDB
                  <ExternalLinkIcon />
                </a>
              )}
              {tvdbId && mediaType === "tv" && (
                <a
                  href={`https://thetvdb.com/?id=${tvdbId}&tab=series`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  TheTVDB
                  <ExternalLinkIcon />
                </a>
              )}
              {overseerrId && overseerrUrl && (
                <a
                  href={`${overseerrUrl}/${tmdbType}/${tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  Overseerr
                  <ExternalLinkIcon />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

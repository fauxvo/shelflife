"use client";

import { useState, type ReactNode } from "react";
import { MediaTypeBadge } from "./MediaTypeBadge";
import { ExternalLinks } from "./ExternalLinks";
import { ClickablePoster } from "./ClickablePoster";
import { MediaDetailModal } from "./MediaDetailModal";
import { STATUS_COLORS } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import type { MediaStatus, MediaType, WatchStatusSummary } from "@/types";

interface BaseMediaCardProps {
  title: string;
  mediaType: MediaType;
  posterPath: string | null;
  status: MediaStatus;

  tmdbId: number | null;
  tvdbId: number | null;
  imdbId: string | null;
  overseerrId: number | null;

  seasonCount: number | null;
  availableSeasonCount: number | null;

  keepSeasons?: number | null;

  watchStatus?: WatchStatusSummary | null;

  fileSize?: number | null;

  requestedByUsername?: string;

  showLastWatched?: boolean;

  children?: ReactNode;
}

export function BaseMediaCard({
  title,
  mediaType,
  posterPath,
  status,
  tmdbId,
  tvdbId,
  imdbId,
  overseerrId,
  seasonCount,
  availableSeasonCount,
  keepSeasons,
  watchStatus,
  fileSize,
  requestedByUsername,
  showLastWatched,
  children,
}: BaseMediaCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
      <ClickablePoster posterPath={posterPath} title={title} onClick={() => setShowDetail(true)}>
        <div className="absolute top-2 left-2 flex gap-1">
          <MediaTypeBadge mediaType={mediaType} />
          <span
            className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[status] || STATUS_COLORS.unknown}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        {watchStatus?.watched && (
          <div className="absolute top-2 right-2">
            <span className="rounded bg-purple-900/80 px-2 py-0.5 text-xs text-purple-300">
              Watched
            </span>
          </div>
        )}
      </ClickablePoster>
      <div className="space-y-2 p-3">
        <h3 className="truncate text-sm font-medium" title={title}>
          {title}
        </h3>
        {keepSeasons != null && keepSeasons > 0 && seasonCount ? (
          <p className="text-xs text-amber-400">
            Keeping latest {keepSeasons} of {seasonCount} seasons
          </p>
        ) : mediaType === "tv" && seasonCount && seasonCount > 1 ? (
          <p className="text-xs text-gray-500">
            {availableSeasonCount && availableSeasonCount !== seasonCount
              ? `${availableSeasonCount} of ${seasonCount} seasons`
              : `${seasonCount} seasons`}
          </p>
        ) : null}
        {requestedByUsername && (
          <p className="text-xs text-gray-400">Requested by: {requestedByUsername}</p>
        )}
        {watchStatus?.playCount || fileSize ? (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {watchStatus && watchStatus.playCount > 0 && (
              <span>
                Plays: {watchStatus.playCount}
                {showLastWatched && watchStatus.lastWatchedAt && (
                  <> | Last: {new Date(watchStatus.lastWatchedAt).toLocaleDateString()}</>
                )}
              </span>
            )}
            {fileSize ? <span>{formatFileSize(fileSize)}</span> : null}
          </div>
        ) : null}
        <ExternalLinks imdbId={imdbId} tmdbId={tmdbId} mediaType={mediaType} />
        {children}
      </div>
      {showDetail && (
        <MediaDetailModal
          title={title}
          mediaType={mediaType}
          status={status}
          posterPath={posterPath}
          seasonCount={seasonCount}
          availableSeasonCount={availableSeasonCount}
          requestedByUsername={requestedByUsername}
          playCount={watchStatus?.playCount}
          fileSize={fileSize}
          tmdbId={tmdbId}
          tvdbId={tvdbId}
          imdbId={imdbId}
          overseerrId={overseerrId}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}

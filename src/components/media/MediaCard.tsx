"use client";

import { useState } from "react";
import { VoteButton } from "./VoteButton";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { ExternalLinks } from "../ui/ExternalLinks";
import { ClickablePoster } from "../ui/ClickablePoster";
import { MediaDetailModal } from "../ui/MediaDetailModal";
import { STATUS_COLORS } from "@/lib/constants";
import type { MediaItemWithVote, VoteValue } from "@/types";

interface MediaCardProps {
  item: MediaItemWithVote;
  onVoteChange?: (itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => void;
}

export function MediaCard({ item, onVoteChange }: MediaCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
      <ClickablePoster
        posterPath={item.posterPath}
        title={item.title}
        onClick={() => setShowDetail(true)}
      >
        <div className="absolute top-2 left-2 flex gap-1">
          <MediaTypeBadge mediaType={item.mediaType} />
          <span
            className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[item.status] || STATUS_COLORS.unknown}`}
          >
            {item.status}
          </span>
        </div>
        {item.watchStatus?.watched && (
          <div className="absolute top-2 right-2">
            <span className="rounded bg-purple-900/80 px-2 py-0.5 text-xs text-purple-300">
              Watched
            </span>
          </div>
        )}
      </ClickablePoster>
      <div className="space-y-3 p-3">
        <h3 className="truncate text-sm font-medium" title={item.title}>
          {item.title}
        </h3>
        {item.mediaType === "tv" && item.seasonCount && item.seasonCount > 1 && (
          <p className="text-xs text-gray-500">
            {item.availableSeasonCount && item.availableSeasonCount !== item.seasonCount
              ? `${item.availableSeasonCount} of ${item.seasonCount} seasons`
              : `${item.seasonCount} seasons`}
          </p>
        )}
        {item.vote === "trim" && item.keepSeasons && item.seasonCount && (
          <p className="text-xs text-amber-400">
            Keeping latest {item.keepSeasons} of {item.seasonCount} seasons
          </p>
        )}
        {item.watchStatus && item.watchStatus.playCount > 0 && (
          <p className="text-xs text-gray-500">
            Played {item.watchStatus.playCount} time{item.watchStatus.playCount !== 1 ? "s" : ""}
          </p>
        )}
        <ExternalLinks imdbId={item.imdbId} tmdbId={item.tmdbId} mediaType={item.mediaType} />
        <VoteButton
          mediaItemId={item.id}
          currentVote={item.vote}
          seasonCount={item.seasonCount}
          mediaType={item.mediaType}
          currentKeepSeasons={item.keepSeasons}
          onVoteChange={(newVote: VoteValue | null, oldVote: VoteValue | null) =>
            onVoteChange?.(item.id, oldVote, newVote)
          }
        />
      </div>
      {showDetail && (
        <MediaDetailModal
          title={item.title}
          mediaType={item.mediaType}
          status={item.status}
          posterPath={item.posterPath}
          seasonCount={item.seasonCount}
          availableSeasonCount={item.availableSeasonCount}
          playCount={item.watchStatus?.playCount}
          tmdbId={item.tmdbId}
          tvdbId={item.tvdbId}
          imdbId={item.imdbId}
          overseerrId={item.overseerrId}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}

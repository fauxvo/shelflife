"use client";

import { useState } from "react";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { ExternalLinks } from "../ui/ExternalLinks";
import { ClickablePoster } from "../ui/ClickablePoster";
import { MediaDetailModal } from "../ui/MediaDetailModal";
import { VoteTallyBar } from "./VoteTallyBar";
import { CommunityVoteButton } from "./CommunityVoteButton";
import { VoteButton } from "../media/VoteButton";
import { STATUS_COLORS } from "@/lib/constants";
import type { CommunityCandidate, CommunityVoteValue, VoteValue } from "@/types";

interface CommunityCardProps {
  item: CommunityCandidate;
  onVoteChange?: (itemId: number, vote: CommunityVoteValue | null, delta: { keep: number }) => void;
  onSelfVoteChange?: (itemId: number, vote: VoteValue | null) => void;
}

export function CommunityCard({ item, onVoteChange, onSelfVoteChange }: CommunityCardProps) {
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
      <div className="space-y-2 p-3">
        <h3 className="truncate text-sm font-medium" title={item.title}>
          {item.title}
        </h3>
        {item.nominationType === "trim" && item.keepSeasons && item.seasonCount ? (
          <p className="text-xs text-amber-400">
            Trim: keep latest {item.keepSeasons} of {item.seasonCount} seasons
          </p>
        ) : item.seasonCount && item.seasonCount > 1 ? (
          <p className="text-xs text-gray-500">
            {item.availableSeasonCount && item.availableSeasonCount !== item.seasonCount
              ? `${item.availableSeasonCount} of ${item.seasonCount} seasons`
              : `${item.seasonCount} seasons`}
          </p>
        ) : null}
        <p className="text-xs text-gray-400">Requested by: {item.requestedByUsername}</p>
        {item.watchStatus && (
          <p className="text-xs text-gray-500">
            Plays: {item.watchStatus.playCount}
            {item.watchStatus.lastWatchedAt && (
              <> | Last: {new Date(item.watchStatus.lastWatchedAt).toLocaleDateString()}</>
            )}
          </p>
        )}
        <ExternalLinks imdbId={item.imdbId} tmdbId={item.tmdbId} mediaType={item.mediaType} />
        {item.status === "removed" ? (
          <div className="rounded bg-red-900/30 px-2 py-2 text-center text-sm font-medium text-red-400">
            Removed from library
          </div>
        ) : (
          <>
            <VoteTallyBar keepCount={item.tally.keepCount} />
            {item.isNominator ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Your nomination — change your vote:</p>
                <VoteButton
                  mediaItemId={item.id}
                  currentVote={item.nominationType}
                  seasonCount={item.seasonCount}
                  mediaType={item.mediaType}
                  currentKeepSeasons={item.keepSeasons}
                  onVoteChange={(newVote: VoteValue | null) => onSelfVoteChange?.(item.id, newVote)}
                />
              </div>
            ) : item.isRequestor ? (
              <div className="space-y-1">
                <p className="text-xs text-amber-400">Admin nomination</p>
                <CommunityVoteButton
                  mediaItemId={item.id}
                  currentVote={item.currentUserVote}
                  onVoteChange={(vote, delta) => onVoteChange?.(item.id, vote, delta)}
                />
              </div>
            ) : (
              <CommunityVoteButton
                mediaItemId={item.id}
                currentVote={item.currentUserVote}
                onVoteChange={(vote, delta) => onVoteChange?.(item.id, vote, delta)}
              />
            )}
          </>
        )}
      </div>
      {showDetail && (
        <MediaDetailModal
          title={item.title}
          mediaType={item.mediaType}
          posterPath={item.posterPath}
          seasonCount={item.seasonCount}
          availableSeasonCount={item.availableSeasonCount}
          requestedByUsername={item.requestedByUsername}
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

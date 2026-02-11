"use client";

import Image from "next/image";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { ExternalLinks } from "../ui/ExternalLinks";
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
  const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
      <div className="relative aspect-[2/3] bg-gray-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-600">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
        )}
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
      </div>
      <div className="space-y-2 p-3">
        <h3 className="truncate text-sm font-medium" title={item.title}>
          {item.title}
        </h3>
        {item.nominationType === "trim" && item.keepSeasons && item.seasonCount ? (
          <p className="text-xs text-amber-400">
            Trim: keep latest {item.keepSeasons} of {item.seasonCount} seasons
          </p>
        ) : item.seasonCount && item.seasonCount > 1 ? (
          <p className="text-xs text-gray-500">{item.seasonCount} seasons</p>
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
    </div>
  );
}

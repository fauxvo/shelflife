"use client";

import { VoteTallyBar } from "./VoteTallyBar";
import { CommunityVoteButton } from "./CommunityVoteButton";
import { VoteButton } from "../media/VoteButton";
import { BaseMediaCard } from "../ui/BaseMediaCard";
import type { CommunityCandidate, CommunityVoteValue, VoteValue } from "@/types";

interface CommunityCardProps {
  item: CommunityCandidate;
  onVoteChange?: (itemId: number, vote: CommunityVoteValue | null, delta: { keep: number }) => void;
  onSelfVoteChange?: (itemId: number, vote: VoteValue | null) => void;
}

export function CommunityCard({ item, onVoteChange, onSelfVoteChange }: CommunityCardProps) {
  return (
    <BaseMediaCard
      title={item.title}
      mediaType={item.mediaType}
      posterPath={item.posterPath}
      status={item.status}
      tmdbId={item.tmdbId}
      tvdbId={item.tvdbId}
      imdbId={item.imdbId}
      overseerrId={item.overseerrId}
      seasonCount={item.seasonCount}
      availableSeasonCount={item.availableSeasonCount}
      keepSeasons={item.nominationType === "trim" ? item.keepSeasons : null}
      watchStatus={item.watchStatus}
      fileSize={item.fileSize}
      requestedByUsername={item.requestedByUsername ?? undefined}
      showLastWatched
    >
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
    </BaseMediaCard>
  );
}

"use client";

import { VoteButton } from "./VoteButton";
import { BaseMediaCard } from "../ui/BaseMediaCard";
import type { MediaItemWithVote, VoteValue } from "@/types";

interface MediaCardProps {
  item: MediaItemWithVote;
  onVoteChange?: (itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => void;
}

export function MediaCard({ item, onVoteChange }: MediaCardProps) {
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
      keepSeasons={item.vote === "trim" ? item.keepSeasons : null}
      watchStatus={item.watchStatus}
      fileSize={item.fileSize}
    >
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
    </BaseMediaCard>
  );
}

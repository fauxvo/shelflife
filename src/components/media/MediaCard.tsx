import Image from "next/image";
import { VoteButton } from "./VoteButton";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { ExternalLinks } from "../ui/ExternalLinks";
import { STATUS_COLORS } from "@/lib/constants";
import type { MediaItemWithVote, VoteValue } from "@/types";

interface MediaCardProps {
  item: MediaItemWithVote;
  onVoteChange?: (itemId: number, oldVote: VoteValue | null, newVote: VoteValue | null) => void;
}

export function MediaCard({ item, onVoteChange }: MediaCardProps) {
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
      <div className="space-y-3 p-3">
        <h3 className="truncate text-sm font-medium" title={item.title}>
          {item.title}
        </h3>
        {item.mediaType === "tv" && item.seasonCount && item.seasonCount > 1 && (
          <p className="text-xs text-gray-500">{item.seasonCount} seasons</p>
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
    </div>
  );
}

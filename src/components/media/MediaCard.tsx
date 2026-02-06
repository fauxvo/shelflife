import Image from "next/image";
import { VoteButton } from "./VoteButton";
import { MediaTypeBadge } from "../ui/MediaTypeBadge";
import { STATUS_COLORS } from "@/lib/constants";
import type { MediaItemWithVote } from "@/types";

interface MediaCardProps {
  item: MediaItemWithVote;
}

export function MediaCard({ item }: MediaCardProps) {
  const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : null;

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
      <div className="aspect-[2/3] relative bg-gray-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status] || STATUS_COLORS.unknown}`}
          >
            {item.status}
          </span>
        </div>
        {item.watchStatus?.watched && (
          <div className="absolute top-2 right-2">
            <span className="text-xs px-2 py-0.5 rounded bg-purple-900/80 text-purple-300">
              Watched
            </span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-3">
        <h3 className="font-medium text-sm truncate" title={item.title}>
          {item.title}
        </h3>
        {item.watchStatus && item.watchStatus.playCount > 0 && (
          <p className="text-xs text-gray-500">
            Played {item.watchStatus.playCount} time{item.watchStatus.playCount !== 1 ? "s" : ""}
          </p>
        )}
        <VoteButton mediaItemId={item.id} currentVote={item.vote} />
      </div>
    </div>
  );
}

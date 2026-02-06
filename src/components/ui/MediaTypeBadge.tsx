interface MediaTypeBadgeProps {
  mediaType: string;
}

export function MediaTypeBadge({ mediaType }: MediaTypeBadgeProps) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded ${
        mediaType === "tv"
          ? "bg-blue-600 text-white"
          : "bg-amber-500 text-black"
      }`}
    >
      {mediaType === "tv" ? "TV" : "Movie"}
    </span>
  );
}

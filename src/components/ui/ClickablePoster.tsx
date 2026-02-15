"use client";

import Image from "next/image";

interface ClickablePosterProps {
  posterPath: string | null;
  title: string;
  onClick: () => void;
  /** Image size hint for `sizes` attr and TMDB URL quality. Defaults to card size. */
  size?: "card" | "compact";
  children?: React.ReactNode;
}

const FILM_ICON_PATH =
  "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z";

const SIZE_CONFIG = {
  card: {
    className:
      "relative aspect-[2/3] w-full cursor-pointer bg-gray-800 transition-opacity hover:opacity-80",
    tmdbWidth: "w300",
    sizes: "(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw",
    iconClassName: "h-12 w-12",
  },
  compact: {
    className:
      "relative h-16 w-11 flex-shrink-0 cursor-pointer overflow-hidden rounded bg-gray-700 transition-opacity hover:opacity-80",
    tmdbWidth: "w92",
    sizes: "44px",
    iconClassName: "h-5 w-5",
  },
} as const;

export function ClickablePoster({
  posterPath,
  title,
  onClick,
  size = "card",
  children,
}: ClickablePosterProps) {
  const config = SIZE_CONFIG[size];
  const posterUrl = posterPath
    ? `https://image.tmdb.org/t/p/${config.tmdbWidth}${posterPath}`
    : null;

  return (
    <button onClick={onClick} className={config.className} title={`View details for ${title}`}>
      {posterUrl ? (
        <Image src={posterUrl} alt={title} fill className="object-cover" sizes={config.sizes} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-600">
          <svg
            className={config.iconClassName}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d={FILM_ICON_PATH} />
          </svg>
        </div>
      )}
      {children}
    </button>
  );
}

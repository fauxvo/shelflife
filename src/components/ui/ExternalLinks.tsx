const ExternalLinkIcon = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

interface ExternalLinksProps {
  imdbId?: string | null;
  tmdbId?: number | null;
  mediaType?: "movie" | "tv";
}

export function ExternalLinks({ imdbId, tmdbId, mediaType }: ExternalLinksProps) {
  if (!imdbId && !tmdbId) return null;

  const tmdbType = mediaType === "tv" ? "tv" : "movie";

  return (
    <div className="flex items-center gap-3">
      {imdbId && (
        <a
          href={`https://www.imdb.com/title/${imdbId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand inline-flex items-center gap-1 text-xs hover:underline"
        >
          IMDB
          <ExternalLinkIcon />
        </a>
      )}
      {tmdbId && (
        <a
          href={`https://www.themoviedb.org/${tmdbType}/${tmdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-tmdb inline-flex items-center gap-1 text-xs hover:underline"
        >
          TMDB
          <ExternalLinkIcon />
        </a>
      )}
    </div>
  );
}

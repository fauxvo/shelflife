interface MediaCardSkeletonProps {
  count?: number;
}

export function MediaCardSkeleton({ count = 10 }: MediaCardSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-gray-800 bg-gray-900"
        >
          <div className="aspect-[2/3] bg-gray-800" />
          <div className="space-y-3 p-3">
            <div className="h-4 rounded bg-gray-800" />
            <div className="h-8 rounded bg-gray-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

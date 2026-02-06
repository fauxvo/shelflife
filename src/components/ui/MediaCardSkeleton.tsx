interface MediaCardSkeletonProps {
  count?: number;
}

export function MediaCardSkeleton({ count = 10 }: MediaCardSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 animate-pulse"
        >
          <div className="aspect-[2/3] bg-gray-800" />
          <div className="p-3 space-y-3">
            <div className="h-4 bg-gray-800 rounded" />
            <div className="h-8 bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

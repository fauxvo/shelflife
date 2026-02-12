"use client";

const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = getPageNumbers(page, totalPages);

  const handlePageChange = (p: number) => {
    onPageChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
      {/* Item count + page size */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <span>
          Showing{" "}
          <span className="font-medium text-gray-200">
            {start}-{end}
          </span>{" "}
          of <span className="font-medium text-gray-200">{totalItems}</span>
        </span>
        <span className="text-gray-600">|</span>
        <label className="flex items-center gap-1.5">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={page === 1}
            title="First page"
            className="rounded bg-gray-800 px-2 py-1.5 text-sm transition-colors hover:bg-gray-700 disabled:opacity-30"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => handlePageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            title="Previous page"
            className="rounded bg-gray-800 px-2 py-1.5 text-sm transition-colors hover:bg-gray-700 disabled:opacity-30"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-600">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`min-w-[2.25rem] rounded px-2 py-1.5 text-sm transition-colors ${
                  p === page
                    ? "bg-brand font-medium text-black"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            title="Next page"
            className="rounded bg-gray-800 px-2 py-1.5 text-sm transition-colors hover:bg-gray-700 disabled:opacity-30"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={page === totalPages}
            title="Last page"
            className="rounded bg-gray-800 px-2 py-1.5 text-sm transition-colors hover:bg-gray-700 disabled:opacity-30"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

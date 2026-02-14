"use client";

import { useState } from "react";

interface DeletionConfirmDialogProps {
  title: string;
  mediaType: "movie" | "tv";
  serviceStatus: { sonarr: boolean; radarr: boolean; overseerr: boolean };
  onConfirm: (deleteFiles: boolean) => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeletionConfirmDialog({
  title,
  mediaType,
  serviceStatus,
  onConfirm,
  onCancel,
  isDeleting,
}: DeletionConfirmDialogProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);

  const hasArrService =
    (mediaType === "movie" && serviceStatus.radarr) || (mediaType === "tv" && serviceStatus.sonarr);

  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
      <h4 className="text-sm font-semibold text-red-400">Confirm Deletion</h4>
      <p className="mt-1 text-sm text-gray-300">
        Are you sure you want to delete &ldquo;{title}&rdquo;?
      </p>

      <div className="mt-3">
        {hasArrService ? (
          <ul className="space-y-1 text-sm text-gray-300">
            {mediaType === "movie" && serviceStatus.radarr && (
              <li className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Radarr (movie library)
              </li>
            )}
            {mediaType === "tv" && serviceStatus.sonarr && (
              <li className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Sonarr (TV library)
              </li>
            )}
            {serviceStatus.overseerr && (
              <li className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Overseerr (requests)
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Only Overseerr request will be removed</p>
        )}
      </div>

      {hasArrService && (
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={deleteFiles}
            onChange={(e) => setDeleteFiles(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800"
          />
          <span className="text-sm text-gray-300">Also delete files from disk</span>
        </label>
      )}

      <p className="mt-2 text-xs text-red-400/70">This action cannot be undone.</p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(deleteFiles)}
          disabled={isDeleting}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Deleting..." : "Confirm Delete"}
        </button>
      </div>
    </div>
  );
}

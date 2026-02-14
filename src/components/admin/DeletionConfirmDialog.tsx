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

  const serviceName = mediaType === "tv" ? "Sonarr" : "Radarr";

  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
      <p className="text-sm text-gray-300">
        Delete <span className="font-medium text-white">&ldquo;{title}&rdquo;</span> from{" "}
        {serviceName}
        {serviceStatus.overseerr ? " and Overseerr" : ""}?
      </p>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={deleteFiles}
          onChange={(e) => setDeleteFiles(e.target.checked)}
          className="rounded border-gray-600 bg-gray-800"
        />
        <span className="text-sm text-gray-300">Also delete files from disk</span>
      </label>

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
          {isDeleting ? "Deleting..." : `Delete from ${serviceName}`}
        </button>
      </div>
    </div>
  );
}

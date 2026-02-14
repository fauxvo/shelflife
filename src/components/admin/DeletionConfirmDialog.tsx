"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

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
  const services = [serviceName, serviceStatus.overseerr && "Overseerr"].filter(Boolean);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, isDeleting]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="border-b border-gray-800 px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/40">
              <svg
                className="h-5 w-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Confirm Deletion</h3>
              <p className="text-sm text-gray-400">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-300">
            You are about to permanently delete{" "}
            <span className="font-semibold text-white">&ldquo;{title}&rdquo;</span> from{" "}
            {services.join(" and ")}.
          </p>

          {/* Service badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/30 px-3 py-1 text-xs font-medium text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {serviceName}
            </span>
            {serviceStatus.overseerr && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/30 px-3 py-1 text-xs font-medium text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Overseerr
              </span>
            )}
          </div>

          {/* Delete files checkbox */}
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-red-600 focus:ring-red-500/30"
            />
            <div>
              <span className="text-sm font-medium text-gray-200">Delete files from disk</span>
              <p className="text-xs text-gray-500">
                Removes the actual media files, not just the library entry
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(deleteFiles)}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Deleting...
              </span>
            ) : (
              `Delete from ${serviceName}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

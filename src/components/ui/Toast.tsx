"use client";

import { useEffect, useState } from "react";

export interface ToastData {
  message: string;
  type: "success" | "error";
}

interface ToastProps extends ToastData {
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, type, onDismiss, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const isSuccess = type === "success";

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${
          isSuccess
            ? "border-green-800 bg-green-950/90 text-green-200"
            : "border-red-800 bg-red-950/90 text-red-200"
        }`}
      >
        <span className="mt-0.5 shrink-0 text-lg">{isSuccess ? "\u2713" : "\u2717"}</span>
        <p className="text-sm leading-relaxed">{message}</p>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          aria-label="Close notification"
          className="ml-auto shrink-0 text-gray-500 hover:text-gray-300"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 2000;
const POPUP_CHECK_MS = 1000;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const STORAGE_KEY = "shelflife-plex-pinId";
const MAX_CONSECUTIVE_ERRORS = 5;

function isPopupClosed(popup: Window): boolean {
  try {
    return popup.closed;
  } catch {
    // Cross-origin access can throw; treat as closed
    return true;
  }
}

export function PlexLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (popupCheckRef.current) {
      clearInterval(popupCheckRef.current);
      popupCheckRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (pinId: string, popup?: Window | null) => {
      setLoading(true);
      let consecutiveErrors = 0;

      // Assign to local variables first, then store in refs.
      // This ensures refs are set before any async callback can call cleanup().
      const pollInterval = setInterval(async () => {
        try {
          const callbackRes = await fetch(`/api/auth/plex/callback?pinId=${pinId}`);
          const data = await callbackRes.json();
          consecutiveErrors = 0;

          if (!callbackRes.ok) {
            console.error("[shelflife] Callback error:", data.error);
            cleanup();
            setError(data.error || `Server error: ${callbackRes.status}`);
            setLoading(false);
            popup?.close();
            return;
          }

          if (data.authenticated) {
            cleanup();
            popup?.close();
            window.location.href = data.user.isAdmin ? "/admin" : "/dashboard";
          }
        } catch (err) {
          consecutiveErrors++;
          console.error("[shelflife] Poll network error:", err);
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            cleanup();
            setError("Network error. Please check your connection and try again.");
            setLoading(false);
            popup?.close();
          }
        }
      }, POLL_INTERVAL_MS);
      pollIntervalRef.current = pollInterval;

      const authTimeout = setTimeout(() => {
        cleanup();
        setLoading(false);
        setError("Authentication timed out. Please try again.");
        popup?.close();
      }, AUTH_TIMEOUT_MS);
      timeoutRef.current = authTimeout;

      // Stop polling if popup closed (desktop flow only)
      if (popup) {
        const popupCheck = setInterval(() => {
          if (isPopupClosed(popup)) {
            cleanup();
            setLoading(false);
          }
        }, POPUP_CHECK_MS);
        popupCheckRef.current = popupCheck;
      }
    },
    [cleanup]
  );

  // On mount, check for pending auth from redirect flow (mobile).
  // Use a ref to guard against React strict mode double-mounting.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    const pendingPinId = sessionStorage.getItem(STORAGE_KEY);
    if (pendingPinId) {
      resumedRef.current = true;
      sessionStorage.removeItem(STORAGE_KEY);
      console.log("[shelflife] Resuming auth after redirect, pinId:", pendingPinId);
      startPolling(pendingPinId);
    }
  }, [startPolling]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Pre-open popup SYNCHRONOUSLY before any async work.
    // Mobile Safari blocks window.open() after an await.
    const popup = window.open("about:blank", "plex-auth", "width=800,height=600");

    try {
      const pinRes = await fetch("/api/auth/plex/pin", { method: "POST" });
      if (!pinRes.ok) {
        popup?.close();
        throw new Error("Failed to create PIN");
      }
      const { pinId, authUrl } = await pinRes.json();

      if (popup && !isPopupClosed(popup)) {
        // Desktop: navigate the pre-opened popup to Plex auth
        popup.location.href = authUrl;
        console.log("[shelflife] PIN created, polling for auth...", { pinId });
        startPolling(pinId, popup);
      } else {
        // Mobile fallback: popup was blocked, redirect current window.
        // Store pinId so we can resume polling when user returns.
        sessionStorage.setItem(STORAGE_KEY, pinId);
        console.log("[shelflife] Popup blocked, redirecting to Plex auth...", { pinId });
        const returnUrl = window.location.origin + window.location.pathname;
        window.location.href = `${authUrl}&forwardUrl=${encodeURIComponent(returnUrl)}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }, [startPolling]);

  return (
    <div className="space-y-4">
      <button
        onClick={handleLogin}
        disabled={loading}
        className="bg-brand hover:bg-brand-hover flex w-full items-center justify-center gap-3 rounded-lg px-6 py-3 font-semibold text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Waiting for Plex...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 22h20L12 2z" />
            </svg>
            Sign in with Plex
          </>
        )}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

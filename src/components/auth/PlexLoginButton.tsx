"use client";

import { useState, useCallback } from "react";

export function PlexLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Create PIN
      const pinRes = await fetch("/api/auth/plex/pin", { method: "POST" });
      if (!pinRes.ok) throw new Error("Failed to create PIN");
      const { pinId, authUrl } = await pinRes.json();

      // Open Plex auth in popup
      const popup = window.open(authUrl, "plex-auth", "width=800,height=600");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const callbackRes = await fetch(`/api/auth/plex/callback?pinId=${pinId}`);
          const data = await callbackRes.json();

          if (data.authenticated) {
            clearInterval(pollInterval);
            popup?.close();
            window.location.href = data.user.isAdmin ? "/admin" : "/dashboard";
          }
        } catch {
          // Keep polling
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
        setError("Authentication timed out. Please try again.");
      }, 5 * 60 * 1000);

      // Stop polling if popup closed
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          clearInterval(pollInterval);
          setLoading(false);
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-[#e5a00d] hover:bg-[#cc8e0b] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}

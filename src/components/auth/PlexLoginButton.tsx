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

      console.log("[shelflife] PIN created, polling for auth...", { pinId });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const callbackRes = await fetch(`/api/auth/plex/callback?pinId=${pinId}`);
          const data = await callbackRes.json();

          console.log("[shelflife] Poll response:", {
            status: callbackRes.status,
            ok: callbackRes.ok,
            authenticated: data.authenticated,
            error: data.error,
          });

          if (!callbackRes.ok) {
            console.error("[shelflife] Callback error:", data.error);
            clearInterval(pollInterval);
            setError(data.error || `Server error: ${callbackRes.status}`);
            setLoading(false);
            popup?.close();
            return;
          }

          if (data.authenticated) {
            clearInterval(pollInterval);
            popup?.close();
            window.location.href = data.user.isAdmin ? "/admin" : "/dashboard";
          }
        } catch (err) {
          console.error("[shelflife] Poll network error:", err);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(
        () => {
          clearInterval(pollInterval);
          setLoading(false);
          setError("Authentication timed out. Please try again.");
        },
        5 * 60 * 1000
      );

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

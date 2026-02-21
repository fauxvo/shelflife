/**
 * Client-safe utility for deriving the public URL of the active request service provider.
 * No server-only imports — safe for "use client" components.
 *
 * For the provider _label_, use the `useProviderLabel()` hook from `@/lib/provider-context`
 * instead (it reads the server-side env vars via React context, avoiding the need for
 * separate NEXT_PUBLIC_* variables).
 */

/**
 * Returns the public-facing URL for the active provider, or undefined if none is set.
 * Used for deep-linking to the Seerr/Overseerr/Jellyseerr UI.
 */
export function getClientProviderUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SEERR_URL ||
    process.env.NEXT_PUBLIC_JELLYSEERR_URL ||
    process.env.NEXT_PUBLIC_OVERSEERR_URL
  );
}

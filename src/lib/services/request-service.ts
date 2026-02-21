import { getOverseerrClient } from "./overseerr";
import { getSeerrClient } from "./seerr";
import { getJellyseerrClient } from "./jellyseerr";

export type RequestProvider = "seerr" | "overseerr" | "jellyseerr";

/**
 * Detects which request service provider is configured.
 * Seerr takes priority; Overseerr and Jellyseerr are legacy fallbacks on the same tier.
 * Throws if none is configured.
 */
export function getActiveProvider(): RequestProvider {
  if (process.env.SEERR_URL && process.env.SEERR_API_KEY) {
    return "seerr";
  }
  if (process.env.OVERSEERR_URL && process.env.OVERSEERR_API_KEY) {
    return "overseerr";
  }
  if (process.env.JELLYSEERR_URL && process.env.JELLYSEERR_API_KEY) {
    return "jellyseerr";
  }
  throw new Error(
    "No request service configured. Set SEERR_URL/SEERR_API_KEY, OVERSEERR_URL/OVERSEERR_API_KEY, or JELLYSEERR_URL/JELLYSEERR_API_KEY."
  );
}

/**
 * Returns the appropriate client singleton based on the active provider.
 */
export function getRequestServiceClient(): ReturnType<
  typeof getSeerrClient | typeof getOverseerrClient | typeof getJellyseerrClient
> {
  const provider = getActiveProvider();
  if (provider === "seerr") return getSeerrClient();
  if (provider === "jellyseerr") return getJellyseerrClient();
  return getOverseerrClient();
}

/**
 * Returns a user-facing label for the active provider (server-side).
 */
export function getProviderLabel(): "Seerr" | "Overseerr" | "Jellyseerr" {
  const provider = getActiveProvider();
  if (provider === "seerr") return "Seerr";
  if (provider === "jellyseerr") return "Jellyseerr";
  return "Overseerr";
}

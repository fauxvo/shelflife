import { createOverseerrClient } from "./overseerr";
import { createSeerrClient } from "./seerr";
import { createJellyseerrClient } from "./jellyseerr";
import {
  getAllServiceConfigs,
  getServiceConfig,
  getActiveRequestProvider,
  getClientGeneration,
} from "./service-config";

export type RequestProvider = "seerr" | "overseerr" | "jellyseerr";

/** Shared types for the request service interface — all three providers return the same shape. */
export interface MediaRequestUser {
  id: number;
  email?: string | null;
  plexUsername?: string | null;
  username?: string | null;
  plexId?: number | null;
  avatar?: string | null;
  requestCount?: number | null;
}

export interface MediaRequest {
  id: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  type: "movie" | "tv";
  media?: {
    id?: number | null;
    tmdbId?: number | null;
    tvdbId?: number | null;
    status?: number | null;
    mediaType?: string | null;
    ratingKey?: string | null;
    externalServiceSlug?: string | null;
  } | null;
  requestedBy?: MediaRequestUser | null;
}

export interface MediaDetail {
  id: number;
  mediaType?: string | null;
  title?: string | null;
  name?: string | null;
  originalTitle?: string | null;
  originalName?: string | null;
  posterPath?: string | null;
  overview?: string | null;
  imdbId?: string | null;
  numberOfSeasons?: number | null;
  externalIds?: { imdbId?: string | null } | null;
  mediaInfo?: {
    seasons?: { seasonNumber: number; status: number }[] | null;
  } | null;
}

export interface RequestClient {
  getRequests(
    take?: number,
    skip?: number
  ): Promise<{ pageInfo: unknown; results: MediaRequest[] }>;
  getAllRequests(): Promise<MediaRequest[]>;
  getMediaDetails(tmdbId: number, mediaType: string): Promise<MediaDetail>;
  getUsers(): Promise<unknown[]>;
  deleteMedia(overseerrMediaId: number): Promise<void>;
}

// Cached client + generation for invalidation
let cachedClient: RequestClient | null = null;
let cachedGeneration = -1;

// Cached provider info for root layout (avoids DB queries on every page load)
const PROVIDER_INFO_TTL_MS = 60_000; // 60 seconds
let cachedProviderInfo: { label: "Seerr" | "Overseerr" | "Jellyseerr"; url?: string } | null = null;
let providerInfoCachedAt = 0;
let providerInfoGeneration = -1;

/**
 * Detects which request service provider is configured.
 * Reads from DB settings first (active_request_provider), falls back to auto-detection.
 * Priority: Seerr > Overseerr > Jellyseerr.
 * Throws if none is configured.
 */
export async function getActiveProvider(): Promise<RequestProvider> {
  const setting = await getActiveRequestProvider();

  if (setting !== "auto" && ["seerr", "overseerr", "jellyseerr"].includes(setting)) {
    const config = await getServiceConfig(setting as RequestProvider);
    if (config) return setting as RequestProvider;
    // If explicit provider is set but not configured, fall through to auto
  }

  // Auto-detect: batch-fetch all configs in one query, then check priority order
  const configs = await getAllServiceConfigs();
  const providers: RequestProvider[] = ["seerr", "overseerr", "jellyseerr"];
  for (const provider of providers) {
    if (configs[provider]) return provider;
  }

  throw new Error(
    "No request service configured. Set SEERR_URL/SEERR_API_KEY, OVERSEERR_URL/OVERSEERR_API_KEY, or JELLYSEERR_URL/JELLYSEERR_API_KEY, or configure services in Admin > Settings."
  );
}

/**
 * Returns the appropriate client based on the active provider.
 * Caches the client and invalidates when settings change.
 */
export async function getRequestServiceClient(): Promise<RequestClient> {
  const generation = getClientGeneration();
  if (cachedClient && cachedGeneration === generation) {
    return cachedClient;
  }

  const provider = await getActiveProvider();
  const config = await getServiceConfig(provider);
  if (!config) {
    throw new Error(`${provider} is the active provider but has no configuration`);
  }

  if (provider === "seerr") {
    cachedClient = createSeerrClient(config);
  } else if (provider === "jellyseerr") {
    cachedClient = createJellyseerrClient(config);
  } else {
    cachedClient = createOverseerrClient(config);
  }
  cachedGeneration = generation;
  return cachedClient;
}

/**
 * Returns cached provider info (label + url) for the root layout.
 * Uses a 60s TTL cache to avoid DB queries on every page load.
 * Cache is also invalidated when settings change (generation counter).
 */
export async function getProviderInfo(): Promise<{
  label: "Seerr" | "Overseerr" | "Jellyseerr";
  url?: string;
}> {
  const generation = getClientGeneration();
  const now = Date.now();
  if (
    cachedProviderInfo &&
    providerInfoGeneration === generation &&
    now - providerInfoCachedAt < PROVIDER_INFO_TTL_MS
  ) {
    return cachedProviderInfo;
  }

  try {
    const provider = await getActiveProvider();
    const config = await getServiceConfig(provider);
    const label =
      provider === "seerr" ? "Seerr" : provider === "jellyseerr" ? "Jellyseerr" : "Overseerr";
    cachedProviderInfo = { label, url: config?.url };
  } catch {
    cachedProviderInfo = { label: "Overseerr" };
  }
  providerInfoCachedAt = now;
  providerInfoGeneration = generation;
  return cachedProviderInfo;
}

/**
 * Returns a user-facing label for the active provider (server-side).
 */
export async function getProviderLabel(): Promise<"Seerr" | "Overseerr" | "Jellyseerr"> {
  return (await getProviderInfo()).label;
}

/**
 * Returns the public-facing URL for the active provider (for deep-linking).
 */
export async function getProviderUrl(): Promise<string | undefined> {
  return (await getProviderInfo()).url;
}

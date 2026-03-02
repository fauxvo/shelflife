import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq, inArray, like } from "drizzle-orm";

export type ServiceType =
  | "seerr"
  | "overseerr"
  | "jellyseerr"
  | "tautulli"
  | "tracearr"
  | "sonarr"
  | "radarr";

export interface ServiceConfig {
  url: string;
  apiKey: string;
}

export const SERVICE_TYPES: ServiceType[] = [
  "seerr",
  "overseerr",
  "jellyseerr",
  "tautulli",
  "tracearr",
  "sonarr",
  "radarr",
];

const ENV_VAR_MAP: Record<ServiceType, { url: string; apiKey: string }> = {
  seerr: { url: "SEERR_URL", apiKey: "SEERR_API_KEY" },
  overseerr: { url: "OVERSEERR_URL", apiKey: "OVERSEERR_API_KEY" },
  jellyseerr: { url: "JELLYSEERR_URL", apiKey: "JELLYSEERR_API_KEY" },
  tautulli: { url: "TAUTULLI_URL", apiKey: "TAUTULLI_API_KEY" },
  tracearr: { url: "TRACEARR_URL", apiKey: "TRACEARR_API_KEY" },
  sonarr: { url: "SONARR_URL", apiKey: "SONARR_API_KEY" },
  radarr: { url: "RADARR_URL", apiKey: "RADARR_API_KEY" },
};

function dbKey(type: ServiceType, field: "url" | "api_key"): string {
  return `service_${type}_${field}`;
}

/**
 * Resolves a service config: DB value takes priority over env var.
 * Returns null if neither source has both url and apiKey.
 */
export async function getServiceConfig(type: ServiceType): Promise<ServiceConfig | null> {
  const urlKey = dbKey(type, "url");
  const apiKeyKey = dbKey(type, "api_key");

  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [urlKey, apiKeyKey]));

  const lookup = new Map(rows.map((r) => [r.key, r.value]));
  const dbUrl = lookup.get(urlKey) || null;
  const dbApiKey = lookup.get(apiKeyKey) || null;

  const envVars = ENV_VAR_MAP[type];
  const url = dbUrl || process.env[envVars.url] || null;
  const apiKey = dbApiKey || process.env[envVars.apiKey] || null;

  if (url && apiKey) {
    return { url, apiKey };
  }
  return null;
}

/**
 * Saves a service config to the DB.
 */
export async function setServiceConfig(type: ServiceType, config: ServiceConfig): Promise<void> {
  const now = new Date().toISOString();
  const entries = [
    { key: dbKey(type, "url"), value: config.url },
    { key: dbKey(type, "api_key"), value: config.apiKey },
  ];

  for (const entry of entries) {
    await db
      .insert(appSettings)
      .values({ key: entry.key, value: entry.value, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: entry.value, updatedAt: now },
      });
  }

  invalidateClients();
}

/**
 * Removes a service config from the DB (env var fallback will still work).
 */
export async function clearServiceConfig(type: ServiceType): Promise<void> {
  await db
    .delete(appSettings)
    .where(inArray(appSettings.key, [dbKey(type, "url"), dbKey(type, "api_key")]));
  invalidateClients();
}

/**
 * Returns all service configs (resolved from DB + env var fallback).
 */
export async function getAllServiceConfigs(): Promise<Record<ServiceType, ServiceConfig | null>> {
  // Batch-fetch all service_* keys from DB
  const rows = await db.select().from(appSettings).where(like(appSettings.key, "service_%"));
  const lookup = new Map(rows.map((r) => [r.key, r.value]));

  const result = {} as Record<ServiceType, ServiceConfig | null>;
  for (const type of SERVICE_TYPES) {
    const envVars = ENV_VAR_MAP[type];
    const url = lookup.get(dbKey(type, "url")) || process.env[envVars.url] || null;
    const apiKey = lookup.get(dbKey(type, "api_key")) || process.env[envVars.apiKey] || null;
    result[type] = url && apiKey ? { url, apiKey } : null;
  }
  return result;
}

const ACTIVE_PROVIDER_KEY = "active_request_provider";

/**
 * Gets the active request provider setting. Defaults to "auto".
 */
export async function getActiveRequestProvider(): Promise<string> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, ACTIVE_PROVIDER_KEY));
  return rows[0]?.value || "auto";
}

/**
 * Sets the active request provider ("auto", "seerr", "overseerr", "jellyseerr").
 */
export async function setActiveRequestProvider(value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ key: ACTIVE_PROVIDER_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now },
    });
  invalidateClients();
}

const ACTIVE_STATS_PROVIDER_KEY = "active_stats_provider";

/**
 * Gets the active stats provider setting. Defaults to "auto".
 */
export async function getActiveStatsProvider(): Promise<string> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, ACTIVE_STATS_PROVIDER_KEY));
  return rows[0]?.value || "auto";
}

/**
 * Sets the active stats provider ("auto", "tautulli", "tracearr").
 */
export async function setActiveStatsProvider(value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ key: ACTIVE_STATS_PROVIDER_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now },
    });
  invalidateClients();
}

/**
 * Masks an API key for display (shows first 4 and last 4 chars).
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// Generation counter for cache invalidation.
// This works because the app runs in a single Node.js process.
let clientGeneration = 0;

export function getClientGeneration(): number {
  return clientGeneration;
}

export function invalidateClients(): void {
  clientGeneration++;
}

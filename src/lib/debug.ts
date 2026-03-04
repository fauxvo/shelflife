/**
 * Debug logger that only outputs when DEBUG=true or DEBUG=1 is set.
 * Usage:
 *   import { debug } from "@/lib/debug";
 *   debug.auth("Creating Plex PIN...");
 *
 * Enable by setting the environment variable: DEBUG=true
 */

const isEnabled =
  process.env.DEBUG === "true" || process.env.DEBUG === "1" || process.env.DEBUG === "*";

function createLogger(prefix: string) {
  return (...args: unknown[]) => {
    if (isEnabled) {
      console.log(`[DEBUG:${prefix}]`, ...args);
    }
  };
}

export const debug = {
  auth: createLogger("auth"),
  sync: createLogger("sync"),
};

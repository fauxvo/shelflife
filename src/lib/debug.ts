/**
 * Structured logger with two tiers:
 *
 * debug.*  — verbose tracing, only outputs when DEBUG=true/1/* is set.
 *   import { debug } from "@/lib/debug";
 *   debug.sync("enriching items...");
 *
 * log.*    — important operational events that should ALWAYS be visible
 *            (errors, warnings, data-integrity issues). Not gated.
 *   import { log } from "@/lib/debug";
 *   log.warn("sync", "adoption failed, falling back to upsert");
 *   log.error("auth", "unexpected error:", err);
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
  cron: createLogger("cron"),
};

/** Always-on logger for production-visible events */
export const log = {
  warn: (prefix: string, ...args: unknown[]) => {
    console.warn(`[${prefix}]`, ...args);
  },
  error: (prefix: string, ...args: unknown[]) => {
    console.error(`[${prefix}]`, ...args);
  },
};

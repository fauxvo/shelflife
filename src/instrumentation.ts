export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initCronScheduler } = await import("@/lib/services/cron");
      await initCronScheduler();
    } catch (err) {
      console.error("[instrumentation] Failed to initialize cron scheduler:", err);
    }
  }
}

import { runFullSync, syncOverseerr, syncTautulli } from "./sync";
import type { SyncProgress } from "./sync";

export async function dispatchSync(
  type: string,
  onProgress?: (progress: SyncProgress) => void
) {
  switch (type) {
    case "overseerr": {
      const count = await syncOverseerr(onProgress);
      return { overseerr: count };
    }
    case "tautulli": {
      const count = await syncTautulli(onProgress);
      return { tautulli: count };
    }
    default: {
      return await runFullSync(onProgress);
    }
  }
}

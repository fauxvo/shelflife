import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { dispatchSync } from "@/lib/services/sync-dispatch";
import type { SyncProgress } from "@/lib/services/sync";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return handleAuthError(error);
  }

  const type = request.nextUrl.searchParams.get("type") || "full";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const onProgress = (progress: SyncProgress) => {
        send("progress", progress);
      };

      try {
        const result = await dispatchSync(type, onProgress);
        send("complete", { success: true, synced: result });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Sync failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { syncRequestSchema } from "@/lib/validators/schemas";
import { runFullSync, syncOverseerr, syncTautulli } from "@/lib/services/sync";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const { type } = syncRequestSchema.parse(body);

    let result;
    switch (type) {
      case "overseerr": {
        const count = await syncOverseerr();
        result = { overseerr: count };
        break;
      }
      case "tautulli": {
        const count = await syncTautulli();
        result = { tautulli: count };
        break;
      }
      default: {
        result = await runFullSync();
        break;
      }
    }

    return NextResponse.json({ success: true, synced: result });
  } catch (error) {
    return handleAuthError(error);
  }
}

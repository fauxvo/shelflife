import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { syncRequestSchema } from "@/lib/validators/schemas";
import { dispatchSync } from "@/lib/services/sync-dispatch";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const { type } = syncRequestSchema.parse(body);

    const result = await dispatchSync(type);

    return NextResponse.json({ success: true, synced: result });
  } catch (error) {
    return handleAuthError(error);
  }
}

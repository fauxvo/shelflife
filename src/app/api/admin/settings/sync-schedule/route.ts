import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { syncScheduleSchema } from "@/lib/validators/schemas";
import { getSyncScheduleSettings, updateSyncScheduleSettings } from "@/lib/services/settings";
import cron from "node-cron";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getSyncScheduleSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = syncScheduleSchema.parse(body);

    // Validate cron expression server-side
    if (!cron.validate(parsed.schedule)) {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    }

    const updated = await updateSyncScheduleSettings(parsed);
    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

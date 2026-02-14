import { NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { getDeletionServiceStatus } from "@/lib/services/deletion";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(getDeletionServiceStatus());
  } catch (error) {
    return handleAuthError(error);
  }
}

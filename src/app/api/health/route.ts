import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";

export async function GET() {
  try {
    // Test DB connection
    await db.select().from(syncLog).limit(1);
    return NextResponse.json({
      status: "ok",
      version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}

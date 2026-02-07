import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", request.url));
}

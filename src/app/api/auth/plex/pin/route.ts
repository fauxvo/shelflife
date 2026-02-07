import { NextResponse } from "next/server";
import { createPlexPin, getPlexAuthUrl } from "@/lib/services/plex-auth";
import { handleAuthError } from "@/lib/auth/middleware";
import { debug } from "@/lib/debug";

export async function POST() {
  debug.auth("POST /api/auth/plex/pin - creating PIN");
  try {
    const pin = await createPlexPin();
    const authUrl = getPlexAuthUrl(pin);

    debug.auth("PIN created successfully", { pinId: pin.id });
    return NextResponse.json({
      pinId: pin.id,
      code: pin.code,
      authUrl,
    });
  } catch (error) {
    debug.auth("PIN creation failed", { error: String(error) });
    return handleAuthError(error);
  }
}

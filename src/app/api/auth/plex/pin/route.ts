import { NextResponse } from "next/server";
import { createPlexPin, getPlexAuthUrl } from "@/lib/services/plex-auth";
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
    console.error("Failed to create Plex PIN:", error);
    debug.auth("PIN creation failed", { error: String(error) });
    return NextResponse.json({ error: "Failed to create Plex PIN" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createPlexPin, getPlexAuthUrl } from "@/lib/services/plex-auth";

export async function POST() {
  try {
    const pin = await createPlexPin();
    const authUrl = getPlexAuthUrl(pin);

    return NextResponse.json({
      pinId: pin.id,
      code: pin.code,
      authUrl,
    });
  } catch (error) {
    console.error("Failed to create Plex PIN:", error);
    return NextResponse.json(
      { error: "Failed to create Plex PIN" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkPlexPin, getPlexUser } from "@/lib/services/plex-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { upsertUser } from "@/lib/services/user-upsert";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { handleAuthError } from "@/lib/auth/middleware";
import { debug } from "@/lib/debug";

export async function GET(request: NextRequest) {
  const pinId = request.nextUrl.searchParams.get("pinId");
  debug.auth("GET /api/auth/plex/callback", { pinId });

  if (!pinId) {
    return NextResponse.json({ error: "pinId required" }, { status: 400 });
  }

  try {
    const pin = await checkPlexPin(Number(pinId));

    if (!pin.authToken) {
      debug.auth("PIN not yet authenticated, still waiting");
      return NextResponse.json({ authenticated: false });
    }

    // Get user info from Plex
    debug.auth("PIN authenticated, fetching Plex user info");
    const plexUser = await getPlexUser(pin.authToken);
    const plexId = String(plexUser.id);

    // Check if this is the first user (auto-admin) or matches ADMIN_PLEX_ID
    const existingUsers = await db.select().from(users).limit(1);
    const isFirstUser = existingUsers.length === 0;
    const isConfiguredAdmin = process.env.ADMIN_PLEX_ID === plexId;
    const isAdmin = isFirstUser || isConfiguredAdmin;

    debug.auth("User auth details", {
      plexId,
      username: plexUser.username,
      isFirstUser,
      isConfiguredAdmin,
      isAdmin,
    });

    // Upsert user
    const result = await upsertUser({
      plexId,
      plexToken: pin.authToken,
      username: plexUser.username || plexUser.title || "Unknown",
      email: plexUser.email || null,
      avatarUrl: plexUser.thumb || null,
      isAdmin,
    });

    const user = result[0];
    debug.auth("User upserted", { id: user.id, plexId: user.plexId });

    // Create JWT session
    const token = await createSession({
      userId: user.id,
      plexId: user.plexId,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    await setSessionCookie(token);
    debug.auth("Session created, login complete");

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    debug.auth("Auth callback FAILED", { error: String(error) });
    return handleAuthError(error);
  }
}

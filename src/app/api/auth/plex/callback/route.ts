import { NextRequest, NextResponse } from "next/server";
import { checkPlexPin, getPlexUser } from "@/lib/services/plex-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const pinId = request.nextUrl.searchParams.get("pinId");
  if (!pinId) {
    return NextResponse.json({ error: "pinId required" }, { status: 400 });
  }

  try {
    const pin = await checkPlexPin(Number(pinId));

    if (!pin.authToken) {
      return NextResponse.json({ authenticated: false });
    }

    // Get user info from Plex
    const plexUser = await getPlexUser(pin.authToken);
    const plexId = String(plexUser.id);

    // Check if this is the first user (auto-admin) or matches ADMIN_PLEX_ID
    const existingUsers = await db.select().from(users).limit(1);
    const isFirstUser = existingUsers.length === 0;
    const isConfiguredAdmin = process.env.ADMIN_PLEX_ID === plexId;
    const isAdmin = isFirstUser || isConfiguredAdmin;

    // Upsert user
    const result = await db
      .insert(users)
      .values({
        plexId,
        plexToken: pin.authToken,
        username: plexUser.username || plexUser.title || "Unknown",
        email: plexUser.email || null,
        avatarUrl: plexUser.thumb || null,
        isAdmin,
      })
      .onConflictDoUpdate({
        target: users.plexId,
        set: {
          plexToken: pin.authToken,
          username: plexUser.username || plexUser.title || "Unknown",
          email: plexUser.email || null,
          avatarUrl: plexUser.thumb || null,
          updatedAt: sql`datetime('now')`,
        },
      })
      .returning();

    const user = result[0];

    // Create JWT session
    const token = await createSession({
      userId: user.id,
      plexId: user.plexId,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    await setSessionCookie(token);

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
    console.error("Auth callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

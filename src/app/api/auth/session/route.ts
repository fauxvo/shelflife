import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const user = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(eq(users.plexId, session.plexId))
    .limit(1);

  if (user.length === 0) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: user[0],
  });
}

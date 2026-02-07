import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

interface UpsertUserData {
  plexId: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  plexToken?: string | null;
  isAdmin?: boolean;
}

export async function upsertUser(data: UpsertUserData) {
  return db
    .insert(users)
    .values({
      plexId: data.plexId,
      username: data.username,
      email: data.email || null,
      avatarUrl: data.avatarUrl || null,
      ...(data.plexToken !== undefined && { plexToken: data.plexToken }),
      ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
    })
    .onConflictDoUpdate({
      target: users.plexId,
      set: {
        username: data.username,
        email: data.email || null,
        avatarUrl: data.avatarUrl || null,
        ...(data.plexToken !== undefined && { plexToken: data.plexToken }),
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();
}

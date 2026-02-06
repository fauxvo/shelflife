import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionPayload } from "@/types";

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Not authenticated", 401);
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!session.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Unexpected error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

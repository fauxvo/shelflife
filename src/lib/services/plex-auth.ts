import { z } from "zod";
import { debug } from "@/lib/debug";

const PLEX_API_BASE = "https://plex.tv/api/v2";

const plexHeaders = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Plex-Client-Identifier": process.env.PLEX_CLIENT_ID || "shelflife",
  "X-Plex-Product": "Shelflife",
  "X-Plex-Version": "1.0.0",
});

const plexPinSchema = z.object({
  id: z.number(),
  code: z.string(),
  authToken: z.string().nullable().optional(),
  expiresAt: z.string().optional(),
});

const plexUserSchema = z.object({
  id: z.number(),
  uuid: z.string().optional(),
  email: z.string().optional(),
  username: z.string(),
  title: z.string().optional(),
  thumb: z.string().optional(),
  authToken: z.string().optional(),
});

export type PlexPin = z.infer<typeof plexPinSchema>;
export type PlexUser = z.infer<typeof plexUserSchema>;

export async function createPlexPin(): Promise<PlexPin> {
  const headers = plexHeaders();
  debug.auth("Creating Plex PIN", {
    url: `${PLEX_API_BASE}/pins`,
    clientId: headers["X-Plex-Client-Identifier"],
  });

  const res = await fetch(`${PLEX_API_BASE}/pins`, {
    method: "POST",
    headers,
    body: JSON.stringify({ strong: true }),
  });

  debug.auth("Plex PIN response", { status: res.status, ok: res.ok });

  if (!res.ok) {
    const body = await res.text();
    debug.auth("Plex PIN error body:", body);
    throw new Error(`Failed to create Plex PIN: ${res.status}`);
  }

  const data = await res.json();
  debug.auth("Plex PIN data", { id: data.id, code: data.code });
  return plexPinSchema.parse(data);
}

export function getPlexAuthUrl(pin: PlexPin): string {
  const clientId = process.env.PLEX_CLIENT_ID || "shelflife";
  const url = `https://app.plex.tv/auth#?clientID=${clientId}&code=${pin.code}&context%5Bdevice%5D%5Bproduct%5D=Shelflife`;
  debug.auth("Generated Plex auth URL", { clientId, code: pin.code, url });
  return url;
}

export async function checkPlexPin(pinId: number): Promise<PlexPin> {
  debug.auth("Checking Plex PIN", { pinId });

  const res = await fetch(`${PLEX_API_BASE}/pins/${pinId}`, {
    headers: plexHeaders(),
  });

  if (!res.ok) {
    debug.auth("Check PIN failed", { status: res.status });
    throw new Error(`Failed to check Plex PIN: ${res.status}`);
  }

  const data = await res.json();
  debug.auth("Check PIN result", { pinId, hasAuthToken: !!data.authToken });
  return plexPinSchema.parse(data);
}

export async function getPlexUser(authToken: string): Promise<PlexUser> {
  debug.auth("Fetching Plex user info");

  const res = await fetch(`${PLEX_API_BASE}/user`, {
    headers: {
      ...plexHeaders(),
      "X-Plex-Token": authToken,
    },
  });

  if (!res.ok) {
    debug.auth("Get user failed", { status: res.status });
    throw new Error(`Failed to get Plex user: ${res.status}`);
  }

  const data = await res.json();
  debug.auth("Plex user", { id: data.id, username: data.username });
  return plexUserSchema.parse(data);
}

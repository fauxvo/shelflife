import { z } from "zod";

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
  const res = await fetch(`${PLEX_API_BASE}/pins`, {
    method: "POST",
    headers: plexHeaders(),
    body: JSON.stringify({ strong: true }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create Plex PIN: ${res.status}`);
  }

  const data = await res.json();
  return plexPinSchema.parse(data);
}

export function getPlexAuthUrl(pin: PlexPin): string {
  const clientId = process.env.PLEX_CLIENT_ID || "shelflife";
  return `https://app.plex.tv/auth#?clientID=${clientId}&code=${pin.code}&context%5Bdevice%5D%5Bproduct%5D=Shelflife`;
}

export async function checkPlexPin(pinId: number): Promise<PlexPin> {
  const res = await fetch(`${PLEX_API_BASE}/pins/${pinId}`, {
    headers: plexHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to check Plex PIN: ${res.status}`);
  }

  const data = await res.json();
  return plexPinSchema.parse(data);
}

export async function getPlexUser(authToken: string): Promise<PlexUser> {
  const res = await fetch(`${PLEX_API_BASE}/user`, {
    headers: {
      ...plexHeaders(),
      "X-Plex-Token": authToken,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Plex user: ${res.status}`);
  }

  const data = await res.json();
  return plexUserSchema.parse(data);
}

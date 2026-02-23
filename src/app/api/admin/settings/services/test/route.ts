import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { SERVICE_TYPES, type ServiceType } from "@/lib/services/service-config";

const VALID_SERVICE_TYPES = new Set<string>(SERVICE_TYPES);

const BLOCKED_HOSTNAMES = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.google",
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
]);

async function testConnection(
  type: ServiceType,
  url: string,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = url.replace(/\/$/, "");

  try {
    let testUrl: string;
    const headers: Record<string, string> = { Accept: "application/json" };

    if (type === "seerr" || type === "overseerr" || type === "jellyseerr") {
      testUrl = `${baseUrl}/api/v1/status`;
      headers["X-Api-Key"] = apiKey;
    } else if (type === "tautulli") {
      const u = new URL(`${baseUrl}/api/v2`);
      u.searchParams.set("apikey", apiKey);
      u.searchParams.set("cmd", "arnold");
      testUrl = u.toString();
    } else if (type === "sonarr" || type === "radarr") {
      testUrl = `${baseUrl}/api/v3/system/status`;
      headers["X-Api-Key"] = apiKey;
    } else {
      return { success: false, message: "Unknown service type" };
    }

    const res = await fetch(testUrl, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: "Authentication failed — check your API key" };
      }
      return { success: false, message: `Server returned ${res.status} ${res.statusText}` };
    }

    return { success: true, message: "Connection successful" };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        return { success: false, message: "Connection timed out after 10 seconds" };
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        return { success: false, message: "Could not connect — check the URL" };
      }
      return { success: false, message: error.message };
    }
    return { success: false, message: "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { type, url, apiKey } = body;

    if (!type || !VALID_SERVICE_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL scheme and hostname to prevent SSRF
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "URL must use http:// or https://" }, { status: 400 });
      }
      if (BLOCKED_HOSTNAMES.has(parsed.hostname)) {
        return NextResponse.json({ error: "This hostname is not allowed" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const result = await testConnection(type as ServiceType, url, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    return handleAuthError(error);
  }
}

import { NextRequest } from "next/server";

export function createRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const init: RequestInit = {
    method: options?.method || "GET",
    headers: options?.headers,
  };

  if (options?.body) {
    init.body = JSON.stringify(options.body);
    init.headers = {
      "Content-Type": "application/json",
      ...init.headers,
    };
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

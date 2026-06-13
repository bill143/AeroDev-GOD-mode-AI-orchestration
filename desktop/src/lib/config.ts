/**
 * Backend endpoint resolution. The desktop client talks to the Arena cloud
 * backend over HTTP + WebSocket (Spec 2.4). For local development the default
 * is the uvicorn dev server; production builds inject NEXT_PUBLIC_ARENA_BACKEND.
 */

const DEFAULT_BACKEND = "http://127.0.0.1:8000";

export function backendHttpBase(): string {
  const env =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_ARENA_BACKEND : undefined;
  const value = (env ?? "").trim();
  return value.length > 0 ? stripTrailingSlash(value) : DEFAULT_BACKEND;
}

/** http(s):// -> ws(s):// for the WebSocket stream. */
export function httpToWs(httpBase: string): string {
  return stripTrailingSlash(httpBase).replace(/^http/i, "ws");
}

export function wsUrlForProject(httpBase: string, projectId: string): string {
  return `${httpToWs(httpBase)}/ws/projects/${encodeURIComponent(projectId)}`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

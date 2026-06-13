/**
 * Multi-monitor pop-out (Spec 2.5). A popped-out window is a *real OS window*
 * (Tauri) that subscribes to the SAME backend stream — it changes only where a
 * view is drawn, never what it is connected to, so it cannot drift out of sync.
 * In a plain browser (dev outside Tauri) it falls back to window.open, which is
 * enough to exercise the same shared-subscription wiring.
 */
"use client";

export type PopOutView = "main" | "feed" | "gate";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function popOutWindow(
  projectId: string,
  view: PopOutView,
): Promise<void> {
  if (typeof window === "undefined") return;
  const url = targetUrl(projectId, view);
  const label = `arena-${view}-${sanitizeLabel(projectId)}-${Date.now()}`;

  if (isTauri()) {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    new WebviewWindow(label, {
      url,
      title: `Arena — ${view} — ${projectId}`,
      width: 760,
      height: 820,
    });
    return;
  }
  window.open(url, label, "width=760,height=820");
}

function targetUrl(projectId: string, view: PopOutView): string {
  const query = `?project=${encodeURIComponent(projectId)}&view=${encodeURIComponent(view)}`;
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/";
  return `${path}${query}`;
}

/** Tauri window labels permit only [a-zA-Z0-9-/:_]. */
function sanitizeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

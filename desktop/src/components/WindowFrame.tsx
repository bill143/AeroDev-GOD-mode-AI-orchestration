"use client";

import { useEffect, useState } from "react";

import { ArenaClient } from "@/lib/arenaClient";
import { backendHttpBase } from "@/lib/config";
import type { PopOutView } from "@/lib/tauriWindows";
import { ProjectScreen } from "./ProjectScreen";

/**
 * Top-level window router. Every window — docked or popped-out — loads the same
 * exported app and reads its target from the URL query (?project=&view=), then
 * subscribes to that project's stream. A pop-out is therefore just this frame
 * pointed at the same project with a focused view (Spec 2.5).
 */
interface FrameParams {
  project: string | null;
  view: PopOutView;
}

function readParams(): FrameParams {
  const sp = new URLSearchParams(window.location.search);
  const rawView = sp.get("view");
  const view: PopOutView =
    rawView === "feed" || rawView === "gate" ? rawView : "main";
  return { project: sp.get("project"), view };
}

export function WindowFrame() {
  const [params, setParams] = useState<FrameParams | null>(null);

  useEffect(() => {
    setParams(readParams());
  }, []);

  if (params === null) return <BootSplash />;
  if (params.project) {
    return <ProjectScreen projectId={params.project} focus={params.view} />;
  }
  return <Landing onOpen={(id) => setParams({ project: id, view: "main" })} />;
}

function BootSplash() {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted">
      Loading Arena…
    </div>
  );
}

function Landing({ onOpen }: { onOpen: (id: string) => void }) {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const client = new ArenaClient(backendHttpBase());
      const snapshot = await client.createProject(id.trim() || undefined);
      onOpen(snapshot.project_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const openExisting = () => {
    const trimmed = id.trim();
    if (trimmed) onOpen(trimmed);
  };

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6">
        <h1 className="mb-1 text-lg font-semibold tracking-widest text-fg">
          ARENA
        </h1>
        <p className="mb-5 text-sm text-muted">
          Mission control for GOD Mode orchestration. Create a project or open an
          existing one to watch its live state.
        </p>
        <label className="mb-1 block text-xs uppercase text-muted" htmlFor="project-id">
          project id
        </label>
        <input
          id="project-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="optional — leave blank to auto-generate"
          className="mb-3 w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg"
          data-testid="project-id-input"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={createProject}
            disabled={busy}
            className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
            data-testid="create-project"
          >
            {busy ? "Creating…" : "Create project"}
          </button>
          <button
            type="button"
            onClick={openExisting}
            disabled={busy || !id.trim()}
            className="rounded-md border border-border px-4 py-2 text-sm text-fg disabled:opacity-50"
            data-testid="open-project"
          >
            Open
          </button>
        </div>
        {error && (
          <p className="mt-3 text-xs text-bad" data-testid="landing-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

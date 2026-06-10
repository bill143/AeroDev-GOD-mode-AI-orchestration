"use client";

import type { StoreState } from "@/lib/types";
import type { PopOutView } from "@/lib/tauriWindows";
import { ConnectionBadge } from "./ConnectionBadge";
import { StatusStrip } from "./StatusStrip";
import { PhaseTimeline } from "./PhaseTimeline";
import { GateCard } from "./GateCard";
import { FeedPanel } from "./FeedPanel";

/**
 * Presentational composition of one project window. Pure function of
 * (state, callbacks) — no data fetching here, which is why it is the layer the
 * unit test drives with real snapshots. `focus` selects the docked "main" view
 * or a single-panel pop-out (Spec 2.5).
 */
export interface ProjectViewProps {
  state: StoreState;
  focus?: PopOutView;
  onApprove: () => void;
  onRequestChanges: (direction: string) => void;
  onRedirect: (direction: string) => void;
  onPopOut?: (view: PopOutView) => void;
}

export function ProjectView({
  state,
  focus = "main",
  onApprove,
  onRequestChanges,
  onRedirect,
  onPopOut,
}: ProjectViewProps) {
  if (focus === "feed") {
    return (
      <div
        className="flex h-screen flex-col gap-3 p-3"
        data-testid="project-view"
        data-focus="feed"
      >
        <FocusHeader title="Live Feed" connection={state.connection} />
        <FeedPanel snapshot={state.snapshot} />
      </div>
    );
  }

  if (focus === "gate") {
    return (
      <div
        className="flex h-screen flex-col gap-3 p-3"
        data-testid="project-view"
        data-focus="gate"
      >
        <FocusHeader title="Approval Gate" connection={state.connection} />
        <GateCard
          state={state}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
          onRedirect={onRedirect}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col"
      data-testid="project-view"
      data-focus="main"
    >
      <StatusStrip state={state} />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_360px] gap-3 overflow-hidden p-3">
        <aside className="flex min-h-0 flex-col gap-2 overflow-auto">
          <PanelTitle title="Lifecycle" />
          <PhaseTimeline snapshot={state.snapshot} />
        </aside>
        <main className="flex min-h-0 flex-col gap-3 overflow-auto">
          <PanelTitle
            title="Main Development"
            pop={onPopOut ? { label: "gate ↗", onClick: () => onPopOut("gate") } : undefined}
          />
          <GateCard
            state={state}
            onApprove={onApprove}
            onRequestChanges={onRequestChanges}
            onRedirect={onRedirect}
          />
        </main>
        <aside className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <PanelTitle
            title="Activity"
            pop={onPopOut ? { label: "feed ↗", onClick: () => onPopOut("feed") } : undefined}
          />
          <FeedPanel snapshot={state.snapshot} />
        </aside>
      </div>
    </div>
  );
}

function PanelTitle({
  title,
  pop,
}: {
  title: string;
  pop?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
        {title}
      </h2>
      {pop && (
        <button
          type="button"
          onClick={pop.onClick}
          className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-fg"
          data-testid="popout"
        >
          {pop.label}
        </button>
      )}
    </div>
  );
}

function FocusHeader({
  title,
  connection,
}: {
  title: string;
  connection: StoreState["connection"];
}) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-sm font-semibold uppercase tracking-widest text-fg">
        {title}
      </h1>
      <ConnectionBadge connection={connection} />
    </div>
  );
}

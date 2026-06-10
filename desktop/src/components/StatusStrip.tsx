import type { StoreState } from "@/lib/types";
import { ConnectionBadge } from "./ConnectionBadge";

/**
 * Persistent status strip (backbone of Spec 6.11). Shows only fields that are
 * REAL today — project, phase, status, connection. Tier / agent-count / cost /
 * depth attach here when Sections 4–6 produce that data; we never render a
 * placeholder number that looks live (CLAUDE §2: no fake states).
 */
export function StatusStrip({ state }: { state: StoreState }) {
  const snap = state.snapshot;
  return (
    <div className="flex items-center justify-between border-b border-border bg-panel-2 px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-semibold tracking-widest text-fg">ARENA</span>
        <span className="text-border">|</span>
        <span className="text-xs uppercase text-muted">project</span>
        <span className="font-mono text-fg">{snap?.project_id ?? "—"}</span>
      </div>
      <div className="flex items-center gap-5">
        <Field label="phase" value={snap?.phase ?? "—"} />
        <Field label="status" value={snap?.status ?? "—"} />
        <ConnectionBadge connection={state.connection} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs uppercase text-muted">{label}</span>
      <span className="font-mono capitalize text-fg">{value.replace(/_/g, " ")}</span>
    </span>
  );
}

"use client";

import { useState } from "react";
import type { StoreState } from "@/lib/types";

/**
 * Approval gate as UI (Spec 6.9). When the backend reports an open gate, the
 * build visibly cannot proceed past this card. Three actions — Approve,
 * Request Changes, Redirect — map to the backend's approve / reject(+direction)
 * commands; the rework loop (Spec 1.6) keeps a rejected gate re-presentable.
 *
 * Build-milestone gates additionally require evidence (working proof, test
 * evidence, rollback note) before Approve appears (Spec 1.5). That evidence is
 * produced once the BUILD phase runs (later sections); this card renders the
 * evidence block when the snapshot carries it and otherwise presents the
 * pre-build gates (initiation/planning/team_assembly) the engine emits today.
 */
export interface GateCardProps {
  state: StoreState;
  onApprove: () => void;
  onRequestChanges: (direction: string) => void;
  onRedirect: (direction: string) => void;
}

export function GateCard({
  state,
  onApprove,
  onRequestChanges,
  onRedirect,
}: GateCardProps) {
  const snap = state.snapshot;
  const [mode, setMode] = useState<null | "changes" | "redirect">(null);
  const [direction, setDirection] = useState("");

  if (!snap) return null;

  const gate = snap.awaiting_gate;
  if (!gate) {
    return (
      <div
        className="rounded-lg border border-border bg-panel p-4"
        data-testid="gate-card"
        data-gate="none"
      >
        <p className="text-sm text-muted">
          {snap.status === "complete"
            ? "Project complete — all gates approved."
            : "No gate open. The team is working; the next gate appears here."}
        </p>
      </div>
    );
  }

  const rejected = snap.status === "rejected";
  const submit = (kind: "changes" | "redirect") => {
    const text = direction.trim();
    if (!text) return;
    if (kind === "changes") onRequestChanges(text);
    else onRedirect(text);
    setDirection("");
    setMode(null);
  };

  return (
    <div
      className="rounded-lg border border-accent bg-panel p-4"
      data-testid="gate-card"
      data-gate={gate}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-warn">
          Gate · {gate.replace(/_/g, " ")}
        </h3>
        <span className="text-xs text-muted">
          build cannot proceed until you approve
        </span>
      </div>
      <p className="mb-4 text-sm text-fg">
        GOD Mode is holding at the <span className="font-mono">{gate}</span> gate.
        Review the deliverable, then decide.
      </p>

      {rejected && snap.last_rejection && (
        <p
          className="mb-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad"
          data-testid="last-rejection"
        >
          Last request for changes: “{snap.last_rejection}” — the gate is
          re-presentable and can still be approved.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={state.pendingAction}
          onClick={onApprove}
          className="rounded-md bg-ok px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          data-testid="approve"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={state.pendingAction}
          onClick={() => setMode(mode === "changes" ? null : "changes")}
          className="rounded-md border border-border px-4 py-2 text-sm text-fg disabled:opacity-50"
          data-testid="request-changes"
        >
          Request Changes
        </button>
        <button
          type="button"
          disabled={state.pendingAction}
          onClick={() => setMode(mode === "redirect" ? null : "redirect")}
          className="rounded-md border border-border px-4 py-2 text-sm text-fg disabled:opacity-50"
          data-testid="redirect"
        >
          Redirect
        </button>
      </div>

      {mode && (
        <div className="mt-3">
          <textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            rows={3}
            placeholder={
              mode === "changes"
                ? "What needs to change?"
                : "Where should the team redirect?"
            }
            className="w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg"
            data-testid="direction-input"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => submit(mode)}
              disabled={state.pendingAction || !direction.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-bg disabled:opacity-50"
              data-testid="direction-submit"
            >
              Send {mode === "changes" ? "changes" : "redirect"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(null);
                setDirection("");
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.error && (
        <p className="mt-3 text-xs text-bad" data-testid="gate-error">
          {state.error}
        </p>
      )}
    </div>
  );
}

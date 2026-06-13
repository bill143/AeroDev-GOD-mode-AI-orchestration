import { LIFECYCLE_PHASES, type ProjectSnapshot } from "@/lib/types";

/**
 * Vertical lifecycle timeline (backbone of Spec 6.8). Renders the five phases
 * in build order, marking the current phase, approved gates, and the gate
 * currently awaiting approval — all straight from the snapshot.
 */
export function PhaseTimeline({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const current = snapshot?.phase ?? null;
  const approvals = snapshot?.gate_approvals ?? {};
  const awaiting = snapshot?.awaiting_gate ?? null;

  return (
    <ol className="flex flex-col gap-2" data-testid="phase-timeline">
      {LIFECYCLE_PHASES.map((phase) => {
        const isCurrent = phase === current;
        const approved = approvals[phase] === true;
        const isAwaiting = awaiting === phase;
        return (
          <li
            key={phase}
            data-phase={phase}
            data-current={isCurrent}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
              isCurrent ? "border-accent bg-panel" : "border-border bg-panel-2"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                approved
                  ? "bg-ok"
                  : isAwaiting
                    ? "bg-warn"
                    : isCurrent
                      ? "bg-live"
                      : "bg-border"
              }`}
            />
            <span
              className={`flex-1 capitalize ${isCurrent ? "text-fg" : "text-muted"}`}
            >
              {phase.replace(/_/g, " ")}
            </span>
            {approved && <span className="text-xs text-ok">approved</span>}
            {isAwaiting && !approved && (
              <span className="text-xs text-warn">awaiting approval</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

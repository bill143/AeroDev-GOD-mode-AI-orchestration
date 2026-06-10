/**
 * Snapshot reduction — the single-source-of-truth rule in code.
 *
 * A server snapshot fully REPLACES local state. Windows never merge, patch, or
 * locally edit authoritative fields; there is exactly one writer (the backend)
 * and every window is a read-only subscriber (Spec 2.5, CLAUDE §4). Malformed
 * frames are ignored so a bad frame can never corrupt the last good state.
 */
import type { ProjectSnapshot, ProjectStatus } from "./types";

const STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "awaiting_approval",
  "running",
  "complete",
  "rejected",
  "error",
]);

export function isProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.project_id === "string" &&
    typeof o.phase === "string" &&
    typeof o.status === "string" &&
    STATUSES.has(o.status as ProjectStatus) &&
    (o.awaiting_gate === null || typeof o.awaiting_gate === "string") &&
    typeof o.gate_approvals === "object" &&
    o.gate_approvals !== null &&
    !Array.isArray(o.gate_approvals) &&
    Array.isArray(o.messages) &&
    (o.last_rejection === null || typeof o.last_rejection === "string") &&
    typeof o.updated_at === "string"
  );
}

/**
 * Returns the incoming snapshot when valid (full replace), otherwise keeps the
 * current one. The reference only changes when a valid frame is applied, so
 * subscribers can rely on identity comparison.
 */
export function applyServerSnapshot(
  current: ProjectSnapshot | null,
  incoming: unknown,
): ProjectSnapshot | null {
  return isProjectSnapshot(incoming) ? incoming : current;
}

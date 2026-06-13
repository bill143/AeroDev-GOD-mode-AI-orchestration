/**
 * Client mirror of the backend data contract (src/backend/schemas.py).
 * The ProjectSnapshot is the single source of truth every window renders;
 * the client never invents or locally mutates these fields (Spec 2.5, CLAUDE §4).
 */

export type ProjectStatus =
  | "awaiting_approval"
  | "running"
  | "complete"
  | "rejected"
  | "error";

export interface ProjectSnapshot {
  project_id: string;
  phase: string;
  status: ProjectStatus;
  awaiting_gate: string | null;
  gate_approvals: Record<string, boolean>;
  messages: string[];
  last_rejection: string | null;
  updated_at: string; // ISO-8601 UTC
}

/** Connection lifecycle for the WebSocket subscription (Spec 2.8 reconnecting). */
export type ConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "not_found"
  | "closed";

export interface StoreState {
  snapshot: ProjectSnapshot | null;
  connection: ConnectionState;
  error: string | null;
  /** True while a gate action is in flight; the authoritative result still
   *  arrives over the stream, this only drives button-disable UX. */
  pendingAction: boolean;
}

export const INITIAL_STORE_STATE: StoreState = {
  snapshot: null,
  connection: "idle",
  error: null,
  pendingAction: false,
};

/** The five lifecycle phases (Spec 1.2), in build order, for the timeline view. */
export const LIFECYCLE_PHASES = [
  "initiation",
  "planning",
  "team_assembly",
  "build",
  "complete",
] as const;

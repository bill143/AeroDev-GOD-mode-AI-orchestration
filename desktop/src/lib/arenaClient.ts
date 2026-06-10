/**
 * Thin HTTP client for the backend command surface (src/backend/app.py).
 * Side-effecting actions (create project, decide gate) go through here; the
 * resulting authoritative state arrives over the WebSocket stream, not from
 * these responses — one source of truth per window (Spec 2.5, CLAUDE §4).
 */
import type { ProjectSnapshot } from "./types";

export interface GateDecision {
  decision: "approve" | "reject";
  /** Free-text rework direction fed back into deliberation (Spec 1.6). */
  direction?: string;
}

export class ArenaHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`HTTP ${status}: ${detail}`);
    this.name = "ArenaHttpError";
  }
}

export class ArenaClient {
  constructor(private readonly base: string) {}

  async createProject(projectId?: string): Promise<ProjectSnapshot> {
    return this.postJson<ProjectSnapshot>("/projects", {
      project_id: projectId ?? null,
    });
  }

  async getProject(projectId: string): Promise<ProjectSnapshot> {
    return this.getJson<ProjectSnapshot>(
      `/projects/${encodeURIComponent(projectId)}`,
    );
  }

  async decideGate(
    projectId: string,
    decision: GateDecision,
  ): Promise<ProjectSnapshot> {
    return this.postJson<ProjectSnapshot>(
      `/projects/${encodeURIComponent(projectId)}/gate`,
      decision,
    );
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`);
    return this.unwrap<T>(res);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.unwrap<T>(res);
  }

  private async unwrap<T>(res: Response): Promise<T> {
    if (!res.ok) {
      throw new ArenaHttpError(res.status, await safeText(res));
    }
    return (await res.json()) as T;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

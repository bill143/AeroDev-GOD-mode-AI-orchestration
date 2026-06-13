/**
 * ProjectStore — the client-side subscription to one project's live state.
 *
 * It is a *read-only* mirror of the backend's single source of truth: it opens
 * a WebSocket to /ws/projects/{id}, applies whole snapshots as they arrive, and
 * reconnects (showing a "reconnecting" state) when the socket drops. Gate
 * actions are fired over HTTP but the new authoritative state is taken from the
 * stream, never from the HTTP response — so two windows can never disagree
 * (Spec 2.4–2.5, CLAUDE §4: the client never executes orchestration).
 *
 * Uses only cross-platform primitives (WebSocket, fetch, timers) so the exact
 * same code runs in the Tauri webview and in the Node integration test.
 */
import { ArenaClient, type GateDecision } from "./arenaClient";
import { wsUrlForProject } from "./config";
import { applyServerSnapshot } from "./snapshot";
import { backoffDelay, CLOSE_NOT_FOUND, shouldReconnect } from "./reconnect";
import { INITIAL_STORE_STATE, type StoreState } from "./types";

export interface ProjectStoreOptions {
  projectId: string;
  httpBase: string;
  keepaliveMs?: number;
  /** Injectable socket factory; defaults to the platform WebSocket. */
  socketFactory?: (url: string) => WebSocket;
}

type Listener = (state: StoreState) => void;

const DEFAULT_KEEPALIVE_MS = 20_000;

export class ProjectStore {
  private state: StoreState = INITIAL_STORE_STATE;
  private readonly listeners = new Set<Listener>();
  private readonly client: ArenaClient;
  private readonly wsUrl: string;
  private readonly keepaliveMs: number;
  private readonly makeSocket: (url: string) => WebSocket;

  private ws: WebSocket | null = null;
  private attempt = 0;
  private intentional = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: ProjectStoreOptions) {
    this.client = new ArenaClient(opts.httpBase);
    this.wsUrl = wsUrlForProject(opts.httpBase, opts.projectId);
    this.keepaliveMs = opts.keepaliveMs ?? DEFAULT_KEEPALIVE_MS;
    this.makeSocket =
      opts.socketFactory ?? ((url: string) => new WebSocket(url));
  }

  getState(): StoreState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  connect(): void {
    if (this.ws) return;
    this.intentional = false;
    this.attempt = 0;
    this.openSocket();
  }

  disconnect(): void {
    this.intentional = true;
    this.clearReconnect();
    this.stopKeepalive();
    if (this.ws) {
      try {
        this.ws.close(1000, "client closed");
      } catch {
        /* already closing */
      }
      this.ws = null;
    }
    this.patch({ connection: "closed" });
  }

  async approve(): Promise<void> {
    await this.act({ decision: "approve" });
  }

  async requestChanges(direction: string): Promise<void> {
    await this.act({ decision: "reject", direction });
  }

  /** Redirect is a rework with direction (Spec 6.9); same rejection mechanic. */
  async redirect(direction: string): Promise<void> {
    await this.act({ decision: "reject", direction });
  }

  private async act(decision: GateDecision): Promise<void> {
    this.patch({ pendingAction: true, error: null });
    try {
      await this.client.decideGate(this.opts.projectId, decision);
      // Intentionally ignore the response body: the new authoritative snapshot
      // is delivered to every window over the stream.
    } catch (err) {
      this.patch({ error: errorMessage(err) });
    } finally {
      this.patch({ pendingAction: false });
    }
  }

  private openSocket(): void {
    this.patch({
      connection: this.attempt === 0 ? "connecting" : "reconnecting",
    });

    let ws: WebSocket;
    try {
      ws = this.makeSocket(this.wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.patch({ connection: "open", error: null });
      this.safeSend("hello");
      this.startKeepalive();
    };

    ws.onmessage = (event: MessageEvent) => {
      const raw = typeof event.data === "string" ? event.data : "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const next = applyServerSnapshot(this.state.snapshot, parsed);
      if (next !== this.state.snapshot) {
        this.patch({ snapshot: next });
      }
    };

    ws.onclose = (event: CloseEvent) => {
      this.ws = null;
      this.stopKeepalive();
      if (event.code === CLOSE_NOT_FOUND) {
        this.patch({ connection: "not_found", error: "project not found" });
        return;
      }
      if (!shouldReconnect(event.code, this.intentional)) {
        this.patch({ connection: "closed" });
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // The close handler drives reconnection; nothing to do here.
    };
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    this.patch({ connection: "reconnecting" });
    this.clearReconnect();
    this.reconnectTimer = setTimeout(
      () => this.openSocket(),
      backoffDelay(this.attempt),
    );
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => this.safeSend("ping"), this.keepaliveMs);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private safeSend(text: string): void {
    try {
      this.ws?.send(text);
    } catch {
      /* socket not open */
    }
  }

  private patch(partial: Partial<StoreState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

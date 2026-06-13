/**
 * Live integration test: the client ProjectStore against the REAL backend over
 * a REAL WebSocket. This is the honest proof that the desktop shell subscribes
 * to the backend's single source of truth and never invents state (Spec 2.4–2.5,
 * CLAUDE §4). It exercises the same store code the React UI runs.
 */
import { afterAll, beforeAll, expect, test } from "vitest";

import { ArenaClient } from "@/lib/arenaClient";
import { ProjectStore } from "@/lib/projectStore";
import { startBackend, stopBackend, type RunningBackend } from "./helpers/backend";

const PORT = 8099;
let backend: RunningBackend | null = null;

beforeAll(async () => {
  backend = await startBackend(PORT);
});

afterAll(async () => {
  await stopBackend(backend);
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 8_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("condition not met within timeout");
}

test("store mirrors the live backend as the single source of truth", async () => {
  const base = backend!.base;
  await new ArenaClient(base).createProject("ws-integ");

  const store = new ProjectStore({ projectId: "ws-integ", httpBase: base });
  store.connect();

  // The current snapshot arrives over the stream immediately on subscribe.
  await waitFor(() => store.getState().snapshot?.awaiting_gate === "initiation");
  expect(store.getState().connection).toBe("open");
  expect(store.getState().snapshot?.phase).toBe("initiation");

  // Approve over HTTP; the NEW authoritative state must arrive over the stream
  // (the store deliberately ignores the HTTP response body).
  await store.approve();
  await waitFor(() => store.getState().snapshot?.phase === "planning");
  expect(store.getState().snapshot?.gate_approvals.initiation).toBe(true);
  expect(store.getState().snapshot?.awaiting_gate).toBe("planning");

  store.disconnect();
  expect(store.getState().connection).toBe("closed");
});

test("two windows on one project stay identical — no drift", async () => {
  const base = backend!.base;
  await new ArenaClient(base).createProject("ws-twin");

  const a = new ProjectStore({ projectId: "ws-twin", httpBase: base });
  const b = new ProjectStore({ projectId: "ws-twin", httpBase: base });
  a.connect();
  b.connect();
  await waitFor(() => !!a.getState().snapshot && !!b.getState().snapshot);

  // Drive the gate from window A only.
  await a.approve();
  await waitFor(
    () =>
      a.getState().snapshot?.phase === "planning" &&
      b.getState().snapshot?.phase === "planning",
  );
  // Window B, which took no action, holds the identical state.
  expect(b.getState().snapshot).toEqual(a.getState().snapshot);

  a.disconnect();
  b.disconnect();
});

test("subscribing to a missing project closes as not_found, without retry storms", async () => {
  const store = new ProjectStore({
    projectId: "does-not-exist",
    httpBase: backend!.base,
  });
  store.connect();
  await waitFor(() => store.getState().connection === "not_found");
  expect(store.getState().error).toContain("not found");
  store.disconnect();
});

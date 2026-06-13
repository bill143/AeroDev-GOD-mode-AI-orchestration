/**
 * Spins up the REAL Arena backend (the verified FastAPI + LangGraph app) for the
 * integration test. No mocks: the test drives the actual orchestration engine
 * over real HTTP and a real WebSocket.
 */
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// desktop/tests/helpers -> desktop/tests -> desktop -> <repo root>
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const PYTHON = path.join(REPO_ROOT, ".venv", "Scripts", "python.exe");

export interface RunningBackend {
  proc: ChildProcess;
  base: string;
}

export async function startBackend(port: number): Promise<RunningBackend> {
  const proc = spawn(
    PYTHON,
    [
      "-m",
      "uvicorn",
      "src.backend.app:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--log-level",
      "warning",
    ],
    { cwd: REPO_ROOT, stdio: "ignore" },
  );

  const base = `http://127.0.0.1:${port}`;
  await waitForHealth(base, proc);
  return { proc, base };
}

export async function stopBackend(backend: RunningBackend | null): Promise<void> {
  if (!backend) return;
  backend.proc.kill();
}

async function waitForHealth(
  base: string,
  proc: ChildProcess,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`backend process exited early with code ${proc.exitCode}`);
    }
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await delay(250);
  }
  throw new Error(
    `backend did not become healthy at ${base} within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

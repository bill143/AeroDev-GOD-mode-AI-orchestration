# Arena Desktop Shell (Section 2, step 2)

Tauri + Next.js desktop shell. It is a **live window only**: it subscribes to the
cloud backend's WebSocket state stream and renders it. All orchestration, agent
execution, and secrets live in the backend, which is the single source of truth
(Spec 2.4–2.5; CLAUDE §4). The client never executes orchestration.

## What it talks to

The verified Section 1/2 backend (`../src/backend`):

| Surface | Purpose |
|---|---|
| `POST /projects` | create a project |
| `GET /projects/{id}` | current snapshot |
| `POST /projects/{id}/gate` | approve / reject (+direction) a gate |
| `WS /ws/projects/{id}` | live `ProjectSnapshot` stream (pushes on subscribe + every change) |

## Run it

1. Start the backend (from the repo root):
   ```
   .\.venv\Scripts\python.exe -m uvicorn src.backend.app:app --reload
   ```
2. Install shell deps (first time): `npm install`
3. Web dev server: `npm run dev` → http://localhost:3000
4. Desktop app: `npm run icon` (first time, generates icons) then `npm run tauri dev`

The default backend is `http://127.0.0.1:8000`; override with
`NEXT_PUBLIC_ARENA_BACKEND` at build time.

## Tests

```
npm run test
```

- `tests/reconnect.test.ts` — reconnect/backoff policy (unit).
- `tests/snapshot.test.ts` — snapshot validation + single-source-of-truth replace (unit).
- `tests/projectStore.integ.test.ts` — **live**: spawns the real backend, opens a
  real WebSocket, and proves the store mirrors backend state, two windows stay
  identical, and a missing project closes as `not_found`.
- `tests/ProjectView.test.tsx` — the UI renders the live snapshot and its gate
  actions fire (jsdom).

## Manual check (not automated)

The multi-monitor **pop-out** is a manual desktop check: run `npm run tauri dev`,
open a project, click a panel's `↗` pop-out, drag the new OS window to another
monitor, and approve a gate — both windows update from the one stream in lockstep.

## Architecture

```
src/lib/        pure, cross-platform logic (types, config, snapshot reducer,
                reconnect policy, HTTP client, ProjectStore subscription)
src/hooks/      useProjectStream — React binding to a ProjectStore
src/components/ presentational shell (StatusStrip, PhaseTimeline, GateCard,
                FeedPanel, ProjectView) + containers (ProjectScreen, WindowFrame)
src/app/        Next.js App Router entry (static export for Tauri)
src-tauri/      Rust shell (real OS windows; opens pop-outs)
```

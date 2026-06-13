# Arena Section 1 — VERIFIED working code

This is a corrected, actually-tested version of Section 1 (orchestration
engine). Every file here was executed; all 9 tests pass on a real run
(LangGraph 1.x, Python 3.12).

## What was wrong with the previous draft (and is fixed here)
1. `MemorySaver` import path was wrong → fixed to `langgraph.checkpoint.memory`.
2. Test file was missing `datetime` import → fixed.
3. **The hard gate did not actually halt** — the old "paused" node was a
   no-op and the graph advanced anyway. This violated the core
   "hard gates are hard" requirement. Fixed using LangGraph's official
   `interrupt()` mechanism: each gate now genuinely stops the run and only
   advances on an explicit approval. Rejection keeps the project gated.
4. `min_rounds` was stored but never enforced → now actually counted.
5. Deprecated `datetime.utcnow()` → replaced with timezone-aware `now(timezone.utc)`.

## Test results (real)
```
9 passed in 0.23s
- test_graph_compiles
- test_gate_halts_without_approval        (proves a gate STOPS the run)
- test_gate_advances_only_after_approval  (proves approval advances it)
- test_rejection_keeps_project_gated      (proves rejection blocks advance)
- test_requires_min_agents
- test_two_round_floor_runs
- test_min_rounds_actually_enforced       (proves 4 rounds really run)
- test_dissent_always_captured
- test_min_rounds_below_floor_rejected
```

## Still deferred (honestly)
- GOD Mode model-based tie-break: interim deterministic rule in place,
  real model version comes with Section 4 (integration layer).
- Checkpoint store (Postgres): needs a live DB to test; not included in this
  run. Build and test it against a real Postgres in Claude Code.

## How to run
```
pip install langgraph pydantic pytest pytest-asyncio
python -m pytest tests/ -v
```

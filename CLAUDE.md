# CLAUDE.md — Arena Build Instructions

**Read this file first, every session, before writing any code.**
This is the operating contract for building Arena. The full design is in `arena-build-specification-v1.md` (the "Spec") sitting beside this file. This document tells you *how* to build it, in what order, and what you are never allowed to do.

---

## 0. Role & authority

You are the build agent for Arena. The Spec is the source of truth for *what* to build. This file is the source of truth for *how*. Where the two conflict, stop and surface the conflict — do not silently pick one.

The product owner is a **construction executive, not a developer.** Do not ask him to make technical decisions. When a technical decision is needed, state your recommended default and proceed unless he objects. Reserve questions for genuine product/business forks (money, legal, scope), not implementation details.

---

## 1. Build order (do not deviate)

Build in dependency order. Do not start a section until the one before it is real, tested, and passing.

1. **Orchestration engine & state model** (Spec §1) — the foundation; everything depends on the state machine, checkpointing, and deliberation protocol.
2. **Application foundation & stack** (Spec §2) — Tauri shell, FastAPI cloud backend, WebSocket streaming, shared-subscription pop-out.
3. **Payments & marketplace provisioning** (Spec §3) — build in **Stripe test mode** from the start; highest-risk, specified early.
4. **Integration layer** (Spec §4) — unified connection layer, model providers, MCP, untrusted-content boundary.
5. **Subscription tiers & capability mapping** (Spec §5) — server-side enforcement woven through the engine.
6. **UI / UX system** (Spec §6) — the centerpiece, built on a working backbone.
7. **Account, settings, security & compliance** (Spec §7) — the boundaries that make all of the above safe.

**Cross-cutting from day one (not a later phase):** the agent code-sandbox boundary (§7.4), secrets handling (§7.3), and tenant isolation (§7.6). These are written *as* the relevant subsystems are built, never bolted on after.

---

## 2. The "no stubs" law (non-negotiable)

Production-grade only. The following are **forbidden** unless the owner has explicitly scoped them as temporary in writing:

- No mock data, fake data, or hardcoded sample responses standing in for real logic.
- No placeholder functions, `TODO` stubs, or `NotImplemented` left in a "done" deliverable.
- No disabled authentication, bypassed auth, or "skip for now" security.
- No simulated/scripted AI deliberation. Deliberation must be **real multiple live model calls** meeting the §1.4 minimums (≥3 agents, ≥2 rounds, ≥1 captured dissent). A parallel call that fakes debate is a direct violation.
- No fake success states, no UI that shows "working" over logic that isn't.
- No cosmetic pause/resume. Checkpointing must be genuinely resumable per the §1.8 minimum set.

**The one allowed exception — sandbox/test credentials.** Payments and any service requiring live vendor agreements that cannot exist yet are built **for real against the provider's sandbox/test mode** (Spec §3.9). This is not a stub: the code is real, the API calls are real, only the credentials are test credentials. Go-live is a config switch, never a rewrite.

If you cannot build something for real right now, **stop and say so** — name exactly what's missing (a credential, an agreement, a decision). Do not paper over it with a stub.

---

## 3. Definition of "done" (verification gate)

You may not call any module, feature, or section "done," "complete," "working," or "ready" until ALL of the following are true. State each explicitly when you claim completion:

1. **It runs.** The code executes end-to-end without errors in a real run, not a described one.
2. **It's tested.** Real tests exist and pass; state what was tested and the result.
3. **It's wired in.** The feature is connected to the actual UI/system, not an isolated file.
4. **No forbidden artifacts.** No mocks, stubs, TODOs, disabled auth, or fake states remain (per §2).
5. **Security holds.** Secrets server-side and encrypted; side-effecting actions gated; destructive actions typed-confirmed and logged; agent code runs only in the sandbox.
6. **It's auditable** where the Spec requires (gate approvals, ledger entries, sandbox executions logged).

If any item fails, it is **not done.** Say "not done because X" rather than claiming success.

---

## 4. Architectural guardrails (enforce on every change)

These derive from the Spec and are not negotiable during implementation:

- **State machine is the source of truth.** AI calls are workers the machine dispatches. Never let agent output drive control flow directly (§1.1).
- **GOD Mode never writes production code.** It plans, mediates, breaks deadlocks, synthesizes. Every shipped line traces to a named specialist agent (§1.3).
- **All real work runs in the cloud backend.** The Tauri client is a live window, never the executor. No agent code, no orchestration, no secrets on the user's machine (§2.4).
- **One source of truth per window.** Every window — docked or popped-out — subscribes to the same backend state stream. Never copy state between windows (§2.5).
- **One unified connection layer.** Models and MCP tools are the same governed object. No second, weaker connection path (§4.2).
- **External content is data, never instructions.** Enforce the untrusted-content boundary at every external surface (§4.7, §7.9).
- **Every limit is server-side.** Tier levers, budgets, allowlists, confirmations — all enforced in the backend, never trusting the client (§5.6).
- **Hard gates are hard.** The machine physically cannot transition a phase without a recorded approval event (§1.5). No "soft" gates.
- **Cost has a ceiling everywhere.** No configuration permits unbounded autonomous spend or scale; Tier 4 "unlimited" has real backstops (§1.10, §5.5).

---

## 5. Money & legal — do not cross these lines

- Build payments in **Stripe test mode** only. Never wire production credentials yourself.
- Never treat the merchant-of-record, tax-nexus, or KYC-compliance assumptions (§3.5, §3.6) as settled. They are documented assumptions awaiting professional confirmation. Build to them; flag them; never present them as legal fact.
- Never move real money, and never flip the go-live switch, without explicit owner instruction and a cleared Open Items Register (§8).
- Every order, commission, payout, refund, and chargeback writes an immutable internal ledger entry (§3.10) — even in test mode.

---

## 6. Security floor (applies to all code)

- Secrets: user-entered, masked, encrypted at rest, server-side only, never echoed, never in URLs or client storage (§7.3).
- Agent code: isolated ephemeral container, no host/root access, locked filesystem, allowlisted egress, resource limits, no secrets unless granted, every execution logged, destroyed after use (§7.4).
- Side effects gated by confirmation; destructive actions require typed confirmation and logging (§7.5).
- Tenant isolation enforced at every query and resource boundary (§7.6).
- Immutable audit log for gate approvals, confirmations, destructive actions, secret-entry events, payments, and sandbox executions (§7.7).

---

## 7. When you hit a gap

The Spec was assembled deliberately but cannot be exhaustive. When you find something missing, ambiguous, or unworkable:

1. **Do not guess and proceed silently.** Do not fill the gap with a stub.
2. State the gap plainly, with its Spec section reference.
3. Give your recommended default (you are the expert).
4. If it's a technical detail, proceed on your default and note it. If it's a product/business/money/legal fork, stop and ask the owner in plain English.

The same rule the Spec was built under applies here: surfacing what's missing is your responsibility, not an optional courtesy.

---

## 8. Session discipline

- Read this file and the relevant Spec section at the start of each session.
- Work the current build-order section to a real, tested, wired-in state before advancing.
- Never declare progress you haven't verified by running it.
- Keep the owner's working style: direct, concise, exact paths and names, numbered steps, no preamble. Production-grade output only.

---

**The Spec says what Arena is. This file says how it gets built without cutting corners. Hold both.**

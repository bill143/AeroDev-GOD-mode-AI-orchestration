# Arena — Build Plan (Roadmap of Record)

**This is the authoritative build sequence.** It supersedes the *ordering* in the
spec's seven sections. The spec (`arena-build-specification-v1.md`) remains the source
of truth for *what* each section contains; `CLAUDE.md` remains the source of truth for
*how* to build. This file is the source of truth for *what order*.

- **One app, two halves:** GOD Mode orchestration + model-comparison modes.
- **Home:** `C:\dev\arena`  ·  **Repo:** `AeroDev-GOD-mode-AI-orchestration`
- **Amended:** 2026-06-09 (7 spec sections → 5 phases; owner-approved).

---

## DONE — verified, tested, pushed
- **Orchestration engine** — state machine, real hard gates (LangGraph `interrupt`),
  deliberation protocol. (Spec §1)
- **Live state-stream backbone** — FastAPI + WebSocket single source of truth. (Spec §2)
- **Proof:** `python -m pytest` → **14 passed** (2026-06-09); commits on `origin/main`.

---

## PHASE 1 — Desktop Shell  *(in progress)*
*Was: Section 2, step 2.*
Tauri + Next.js windows: GOD Mode window, Main Dev window, agent windows, and
multi-monitor pop-out. (Pop-out is verified by a manual desktop check, not an auto-test.)
- **Prereqs (install once):** Node.js LTS + Rust toolchain.

## PHASE 2 — Integration + Agents + Tiers + Sandbox + Secrets  *(the heart)*
*Merges: Spec §4 + §5 + the agent-sandbox (§7.4) and secrets-storage (§7.3) of Section 7.*
- Real model connections: Anthropic (Claude), OpenAI (GPT), Google (Gemini) — provider-agnostic.
- Unified connection layer (models + MCP governed identically).
- MCP server support (built-in common servers + arbitrary on-demand).
- Agents become real — replace the placeholder model calls in the deliberation engine.
- Subscription tiers wired as settings ON the model layer: model access, deliberation
  rounds, agent count, integration breadth, cost ceilings — **server-side enforced**.
  Interim entitlement (before payments exist) is set by **admin grant** — real, not a stub.
- **Agent code sandbox** built WITH this (isolated container, no host/root, allowlisted
  egress, logged) — load-bearing the moment agents run code.
- **Secrets storage moved up to here (amendment):** real provider API keys appear in this
  phase, so encrypted, server-side-only secret storage is built now — not deferred.
  (SSO/login itself stays in Phase 5; only the encrypted storage moves up.)
- **Tenant-ownership tag designed into the first tables here (amendment):** every saved
  row carries a "which customer owns this" tag from day one. Full enforcement + audit
  lands in Phase 5, but the data seam is laid now so it is never a retrofit.
- **Keep payment/ledger hookup points in mind** while designing Phase 2 data, so Phase 4
  is a wire-in, not a rebuild.
- *Why first after the shell: this is the heart of the product; everything visible depends on it.*

## PHASE 3 — UI / UX + Compare Modes  *(everything the user sees)*
*Was: Section 6. Pulls in the "Elite Arena" compare spec + the old-folder prototype
(`AeroDev - Orchestrator`, reference-only).*
- The four base modes: Direct, Side-by-Side, Battle, Agent.
- Live development feed / Main Dev timeline.
- Deliberation view (watch agents debate), gate cards, cost/tier status strip.
- Shared design system (dark mission-control aesthetic); mobile approve-from-anywhere.
- Fold in the model-comparison half here (side-by-side, blind voting, analytics roster).

## PHASE 4 — Payments & Marketplace  *(off the critical path)*
*Was: Section 3. Resequenced later (owner-approved). Stripe **test mode** only; cannot go
live until legal sign-offs.*
- Stripe Connect Express, split-at-source, internal double-entry ledger.
- Automated + guided-manual provisioning, spend-confirmation gate.
- *Deferred to here because it blocks nothing upstream and needs business/legal work anyway.*

## PHASE 5 — Security Close-out + Compliance  *(final hardening)*
*Rest of Section 7 not already woven into Phases 2–3.*
- SSO/auth (Google + Microsoft); secrets *lifecycle* completion (storage already in Phase 2).
- Tenant isolation **enforced** at every boundary (tag was designed in at Phase 2).
- Immutable audit log (gate approvals, confirmations, destructive actions, payments, sandbox runs).
- SOC 2-aligned posture for later certification.

---

## Cross-cutting (woven in, never a standalone phase)
- Agent code sandbox → built in Phase 2.
- Secrets storage → Phase 2 (moved up). Secrets *lifecycle*/SSO → Phase 5.
- Tenant-ownership tag → designed in Phase 2; enforced + audited in Phase 5.

## Pre-launch (business/legal — NOT build work; before real money/users)
- Merchant-of-record + sales-tax nexus + KYC legal/accountant sign-off.
- Signed vendor pre-agreements + production Stripe credentials.
- Free-tier decision + real pricing / cost-ceiling numbers.
- SOC 2 formal certification.

---

## What changed from 7 sections (and why it's safe)
1. **Integration moved before payments** — agents are the heart; payments can't go live yet anyway.
2. **Tiers merged into integration** — tiers are settings on the model layer, not a separate build.
3. **Security distributed** — sandbox + secrets-storage into Phase 2; auth/tenant-enforcement/audit
   into Phase 5; only the close-out remains its own step.
4. **Payments moved to Phase 4** — off the critical path, sandbox-only until legal clears.

Net: 7 → 5 by resequencing and merging dependent work, **not by cutting scope.**

## How we go faster
Remove per-phase Q&A: pre-decide each phase's questions in advance so the build runs nearly
uninterrupted. Safe concurrency = the owner planning ahead while one builder session works —
**never two builder sessions on one repo** (that causes merge conflicts and lost work).

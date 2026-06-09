# Arena — Consolidated Build Specification (v1)

**Product:** Arena — Multi-Model AI Platform with GOD Mode Orchestration
**Document purpose:** Single source-of-truth specification for Claude Code to build from. Consolidates all seven design sections in dependency order, plus the open-items register.
**Status:** Design locked. Open business/legal/tax items tracked in Section 8.
**Audience served:** A 40-year developer and a complete non-developer, simultaneously — bridged by the GOD Mode orchestrator's intelligence.

---

## How to read this document

Sections are ordered by build-risk and dependency, not visual appeal. Build in this order. Every numbered decision below was reviewed and approved by the product owner. Items marked **⚠️** are legal/tax/business decisions that gate go-live and must be cleared before the relevant subsystem moves real money or launches commercially — they do **not** block building in sandbox/test mode.

---

# Section 1 — Orchestration Engine & State Model

## 1.1 Architectural overview

The orchestration engine is a **deterministic state machine wrapping non-deterministic model calls.** The state machine is the source of truth; AI agents are workers it dispatches. This separation is what makes pause/resume, crash recovery, and gate approvals real rather than cosmetic — machine state survives independently of any model call.

- **Backbone:** LangGraph (explicit graph-based state machine, native checkpointing, human-in-the-loop interrupts).
- **Role/team layer:** CrewAI-style role definitions for specialist agent composition.
- **Persistence:** every state transition is written to a durable checkpoint store before the next step executes.

```
USER --talks only to--> GOD MODE (Orchestrator)
                            |
                            +-- plans, delegates, mediates, resolves deadlock, synthesizes
                            |   (never writes production code)
                            v
                    SPECIALIST AGENT TEAM
              (frontend, backend, DB, security, etc.)
                            |
                            v
                  DELIBERATION PROTOCOL --> DECISION --> BUILD
                            |
                            v
                    CHECKPOINT STORE (durable, resumable)
```

## 1.2 Master state machine

One phase at a time; gates separate phases; a gate transition requires an explicit, recorded user-approval event.

| Phase | Entry condition | Exit (gate) |
|---|---|---|
| `INITIATION` | User pitches project | Initiation Gate approved |
| `PLANNING` | Initiation approved | Planning Gate approved |
| `TEAM_ASSEMBLY` | Planning approved | Team Assembly Gate approved |
| `BUILD` | Team approved | Each Build Milestone Gate approved |
| `COMPLETE` | Final build gate approved | — |

Cross-cutting states (any phase): `PAUSED`, `REWORK`, `CHANGE_REVIEW`, `CRASH_RECOVERY`.

## 1.3 Orchestrator role boundary

GOD Mode is **planning and mediation only.** It interviews the user, compiles requirements, produces the plan/architecture/component list/third-party-services list, assembles and assigns the team, mediates deliberation, breaks deadlocks, and synthesizes deliverables. **GOD Mode never writes production code** — every shipped line is authored by a named specialist agent, keeping the audit trail clean and the hierarchy accountable.

## 1.4 Real deliberation protocol

Enforced as a required sub-graph every build decision must pass through. Trivial parallel calls cannot satisfy it; the machine checks structural minimums before accepting a decision.

**Enforced minimums (base tier — Tier 1):**
- **≥ 3 participating specialist agents** per build decision.
- **≥ 2 deliberation rounds:** Round 1 = independent proposals; Round 2 = cross-critique and revision; then convergence.
- **≥ 1 captured dissent/alternative** before convergence is allowed. If all agents trivially agree in Round 1, the machine forces a mandatory red-team round (one agent assigned to argue an alternative) — preventing rubber-stamping.

```
ROUND 1 - PROPOSE     each agent independently submits an approach
ROUND 2 - CRITIQUE    each agent reviews others, flags risks, revises
        - CONVERGE     agents attempt agreement
   +- agreement reached --> DECISION recorded (with captured dissent)
   +- no agreement -------> DEADLOCK --> GOD Mode tie-breaks
```

**Deadlock handling:** if agents don't converge within the round limit, GOD Mode makes the final call, **records the disagreement and reasoning verbatim,** and **flags it for surfacing at the next approval gate** so the user can override. Deadlocks are never hidden.

**Tier scaling:** minimum agents and rounds rise by tier (Section 5); never drop below the Tier 1 floor.

**Transcript storage:** every proposal, critique, dissent, and final decision is stored per project, retained for the life of the project, viewable in any agent window, and exportable.

## 1.5 Milestone gates & evidence standard

Four mandatory gates. Each is a hard stop — the machine cannot transition without a recorded approval event.

| Gate | Deliverable presented | "Approved" unlocks |
|---|---|---|
| 1. Initiation | Complete component/item list + all required third-party services | Planning |
| 2. Planning | Full project plan + architecture + cost ceiling/estimate | Team Assembly |
| 3. Team Assembly | Proposed team + which agent owns which discipline | Build |
| 4. Build Milestone (repeats) | The completed deliverable for that phase | Next build phase |

**Build Gate evidence standard (mandatory):** every build milestone must present three artifacts before the "Approve" control appears:
1. **Working proof** — a demo or runnable preview.
2. **Test evidence** — what was tested and the result.
3. **Rollback note** — how to revert this specific deliverable.

This converts "looks good" into auditable sign-off.

## 1.6 Gate rejection — rework loop (default)

On any rejection: all previously approved work is preserved; only the rejected deliverable is revised; the team re-presents the same gate; the user may attach free-text direction that feeds back into deliberation as a new constraint; the project does not advance until the gate passes. Alternative paths (revert-to-checkpoint, branch) exist but the rework loop is the enforced default.

## 1.7 Change control (post-Planning)

Once the Planning Gate is approved, scope changes follow the `CHANGE_REVIEW` state:

```
Change request --> Impact summary (what it affects, cost, time) --> User re-approval --> Applied
```

No change touches the build until the user approves the impact summary.

## 1.8 Checkpointing & resumability

**Minimum checkpointed set (all restorable):** conversation/orchestration state; each agent's task state; generated code/repository state; external integration/connection state (mode only — never the secrets, stored separately encrypted); user's window layout.

- **Resumability window:** a paused project is fully resumable for **90 days of inactivity**, then moved to **cold archive** (recoverable, not instantly live). Active projects persist indefinitely while the subscription is active.
- **Crash recovery:** on reconnect, restore to the last completed checkpoint (last finished agent task); partial work since that checkpoint is discarded and that task re-runs; nothing destructive is replayed; the user sees an explicit "restored to X; re-running Y" summary.
- **Global interrupt:** a Stop/Pause control is always live during BUILD; pause freezes every agent at its next safe checkpoint (never mid-write); the user can redirect, then resume cleanly.

## 1.9 Execution model

GOD Mode computes a dependency graph at planning time: independent tasks run in parallel (e.g., frontend + database simultaneously); dependent tasks run sequentially; each agent streams into its own dedicated window regardless.

## 1.10 Cost governance

Every project carries a **budget ceiling** (scales by tier), an **estimated-cost preview shown at the Planning Gate** before building begins, and a **hard pause** if a build approaches the ceiling (stops and asks the user to raise the cap or re-scope). No configuration permits unbounded autonomous spend.

---

# Section 2 — Application Foundation & Stack

## 2.1 Foundation decision: Tauri desktop application

Arena is a **desktop application built on Tauri**, with the entire UI written as a standard web app inside the Tauri shell. The deciding factor is the multi-monitor pop-out requirement (the centerpiece interaction): a pure browser cannot keep detached windows in reliable live sync. Tauri provides real OS windows, real monitor placement, and shared live state across them.

**Tauri over Electron:** smaller/faster native binary (uses the OS web renderer, not a bundled browser); smaller security surface (better for the agent code-sandbox model); single web codebase. **Platform order:** Windows first, macOS second.

## 2.2 No browser-only version in v1

v1 is the Tauri desktop app only. A browser version is deferred — building both doubles the surface and the pop-out centerpiece degrades in a browser regardless.

## 2.3 The stack

| Layer | Technology | Why |
|---|---|---|
| Desktop shell | Tauri | Native multi-window, monitor placement, shared live state, small/secure |
| Frontend | Next.js + React + TypeScript | Strongest ecosystem for a live-streaming dashboard |
| Styling | Tailwind CSS + shadcn/ui | Consistent design tokens, fast component base |
| Backend | Python + FastAPI | LangGraph/CrewAI and the AI ecosystem are Python-first |
| Orchestration | LangGraph + CrewAI patterns | State machine, checkpointing, human-in-the-loop |
| Live transport | WebSockets | Real-time bidirectional streaming that keeps all windows in sync |

The clean split: TypeScript owns UI and windowing; Python owns agents, orchestration, and execution.

## 2.4 Execution topology: cloud backend, desktop window

```
   USER'S COMPUTER                          ARENA CLOUD
+--------------------+              +--------------------------+
|  Tauri Desktop App  |              |  FastAPI Backend          |
|  +--------------+   |   WebSocket  |  +--------------------+   |
|  | GOD Mode win  |<--+--------------+->| Orchestration       |   |
|  | Agent windows |   |   (live      |  | engine (LangGraph)  |   |
|  | Main Dev win  |   |   stream)    |  +--------------------+   |
|  +--------------+   |              |  | Specialist agents   |   |
|  (each = real OS    |              |  | Isolated sandboxes  |   |
|   window, any       |              |  | + live preview      |   |
|   monitor)          |              |  | Checkpoint store     |   |
+--------------------+              +--------------------------+
```

Orchestration, all agent execution, all agent-run code, and the live app preview run in Arena's cloud — not on the user's machine. Reasons: agent code must be sandboxed in isolated containers Arena controls (safety); builds must not depend on user hardware; crash recovery must work even if the user's machine dies; every window reads one cloud source of truth.

## 2.5 Multi-monitor pop-out architecture

**Mechanism: shared-subscription, single source of truth.** Every window is a live subscriber to the same backend state stream over WebSocket. Windows never copy state to each other. Consequences: a window cannot drift out of sync (no second copy exists to drift); closing/reopening loses nothing (re-subscribe shows current live state); pop-out is instant and stateful (detaching changes only where a window is drawn, not what it's connected to).

Tauri spawns each popped-out window as a real OS window on whatever monitor the user chooses. Layout is fully user-controlled and is part of checkpointed state (restored on resume).

**v1 pop-out scope:** sync guaranteed across (i) the same machine and (ii) the same user session. Multi-device live sync is out of scope for v1.

## 2.6 Main Development Window — v1 artifact pipeline

**Mandatory in v1, shown in real development order:** scope of work → specifications → database schema/layout → live running-app preview. **Deferred to v1.1:** auto-generated UI wireframes and design mockups as distinct artifacts (the running-app preview already shows the real evolving UI).

## 2.7 Live app preview — sandboxed rendering

The running-app preview executes in an isolated, sandboxed server-side environment; its live view streams into the Main Window. The user's machine never executes in-progress code.

## 2.8 Connectivity

Arena requires an internet connection (models, cloud backend, agent execution, provisioning all need it). No offline mode in v1. On connection loss, the app shows a clear "reconnecting" state and resumes from the last checkpoint on reconnect.

---

# Section 3 — Payments & Marketplace Provisioning

## 3.1 Risk posture

The only subsystem where a mistake costs real money or creates legal liability. Three non-negotiable principles: (1) built real, run in test mode until legally ready — every path is real code against the real provider API, only credentials are test credentials; (2) money is never out-of-pocket for Arena — every payment split at source, no card on file; (3) three items are legal/financial, not engineering — merchant-of-record posture, tax nexus, connected-account compliance are built to documented assumptions and must be confirmed by professionals before go-live (marked ⚠️).

## 3.2 Commercial model

Arena negotiates pre-agreements with third-party providers, earns a commission per sale, and uses that commission to lower the base price to the end user. The user pays less than going direct; Arena still earns.

## 3.3 Provider & account model

- **Provider:** Stripe Connect.
- **Account type:** Stripe Connect **Express** — Stripe hosts vendor onboarding and carries the heaviest KYC/identity burden; Arena controls the split and retains commission automatically; clean vendor UX. ⚠️ *Confirm with payments counsel before go-live.*

## 3.4 Split-at-source mechanic

```
                 ONE USER PAYMENT (discounted price)
                            |
                  Stripe Connect splits at source
                   +--------+--------+
            Arena commission     Vendor balance
            (retained)           (routed directly to vendor account)
```

One user payment at the discounted price; Stripe splits at source; Arena's commission retained, remainder transferred directly to the vendor's connected account. No card-on-file, no out-of-pocket payout.

## 3.5 Merchant of record & liability ⚠️

**Build assumption (confirm with counsel before go-live):** per transaction, the vendor is the merchant of record for their own product; Arena is a platform/marketplace earning a commission. This is the posture Stripe Connect Express supports. The SOW is correct that split-at-source does not automatically remove money-transmitter/merchant-of-record exposure — documented as an explicit assumption and tracked as a pre-launch legal blocker. Architecture does not depend on this being true in any unchangeable way.

## 3.6 Tax handling ⚠️

Integrate Stripe Tax for automatic calculation. Vendors are responsible for their own product's tax; Arena handles tax on its commission/platform fee only. The system collects and records all data needed for reporting. Sales-tax nexus and reporting thresholds are an accountant determination (⚠️ pre-launch blocker), not a code setting.

## 3.7 Refunds, chargebacks, disputes

| Event | Handling |
|---|---|
| Refund | Reverses the original split proportionally: Arena returns commission, vendor returns their portion |
| Chargeback/dispute | Charged to the vendor (merchant of record); Arena's commission clawed back automatically |
| Every case | Recorded as immutable entries in the internal ledger (3.10) |

## 3.8 Vendor onboarding / KYC

Vendors onboard through Stripe Express's hosted KYC flow (identity, bank, tax). Stripe verifies; Arena never stores vendor banking details. No payout to an unverified account.

## 3.9 Sandbox-first build

The entire payment and provisioning subsystem is built for real against Stripe test mode: real Connect API calls, real split logic, real webhook handling (payment success, refund, dispute, payout), real ledger entries, test credentials and test connected accounts. Go-live is a configuration switch (production credentials + signed vendor agreements + cleared ⚠️ blockers), not a rebuild.

## 3.10 Internal ledger / audit trail

Arena maintains its own internal double-entry ledger, independent of Stripe and authoritative as Arena's books: records every order, commission, payout, refund, and chargeback; every entry immutable and timestamped. Required even with automated splits.

## 3.11 Provisioning — two paths

**Path A — Automated (provider has a provisioning API):**
```
User confirms purchase (itemized) --> Stripe split payment -->
Arena calls provider API --> Provider returns resource (API key/DB/etc.) -->
Secret captured directly into encrypted secret store --> Flows into project
```
The returned secret goes straight into the encrypted secret store (Section 7) — never shown in plain text, never in a URL, never echoed.

**Path B — Guided manual (no provisioning API), with teeth:** (1) numbered step checklist; (2) proof-of-setup validation — Arena tests the obtained credential and will not advance until it validates; (3) secure capture into the encrypted store, masked, never echoed.

**Provisioning gap (no pre-agreement yet):** Arena falls back to guided manual provisioning at the standard (non-discounted) price; the user still gets what they need, without the commission discount; the system flags a "provisioning gap" for Arena to pursue a future agreement.

## 3.12 Spend confirmation gate

No paid service is ever provisioned without an explicit, itemized user confirmation showing what's being bought, the price, and the split. The most side-effecting action in the product; the gate cannot be bypassed.

---

# Section 4 — Integration Layer

## 4.1 Principle

Makes "95% of development happens inside Arena" true. Every connection — model or tool — is the same kind of object governed by one consistent security model. No weaker path for any connection type.

## 4.2 Unified connection layer

A single connection abstraction beneath everything. Model connections and MCP servers are both "connections" subject to identical rules: encrypted server-side secret storage; server-side-only invocation; per-tool allowlist; confirmation gate on side-effecting actions; external content treated as untrusted data; test-connection health check.

## 4.3 AI model providers

Built-in at v1: **Anthropic (Claude), OpenAI (GPT), Google (Gemini).** Adding a provider is configuration, not a rebuild (provider-agnostic interface). Three providers is functional, not cosmetic — the orchestrator's job of assigning the strongest agent per discipline requires a real choice of models.

## 4.4 Model access & billing

**Arena's keys, billed into the subscription.** The user never handles their own model API keys; quality scales by subscription (Section 5) because Arena controls which models each tier reaches. Bring-your-own-key is a deferred v1.1 option. Arena metering all model usage is what enables the cost governor (1.10).

## 4.5 MCP server support — open extensibility

Two layers: (1) built-in common MCP servers (file ops, web fetch, GitHub/version control, database tools, etc.) for the bulk of needs; (2) arbitrary on-demand MCP connection — the user or orchestrator (with user confirmation) can connect any MCP server for the rare/uncommon/newly-released tool.

## 4.6 Governance — allowlists & confirmation gates

Every connected tool is governed in-console: a per-tool allowlist of permitted actions; explicit user confirmation for any side-effecting action (write, external API call, spend, delete); heaviest gate (typed confirmation + logging) for destructive actions. Read-only runs freely.

## 4.7 Untrusted-content boundary (prompt-injection defense)

All content returned from any external tool, model endpoint, or fetched source is handled as data, never as instructions — enforced at the integration boundary. An agent's instructions come only from the orchestration engine, never from fetched content. Closes the prompt-injection attack surface.

## 4.8 Who connects a tool

Either the user or the orchestrator can initiate; the user always confirms and completes. GOD Mode can propose a connection; the connection and any secret entry are completed by the user with explicit confirmation. The orchestrator never silently connects anything or enters a secret on the user's behalf.

## 4.9 Connection health testing

Every connection exposes a server-side "test connection" action that reports whether it works before the orchestrator relies on it. Broken connections surface early, not mid-build.

## 4.10 Tier-gated integration breadth

Lower tiers: built-in integrations. Higher tiers: full arbitrary MCP connection plus more concurrent connections. Exact limits in Section 5.

## 4.11 Missing-integration handling

If a needed capability has no built-in or connectable tool, GOD Mode surfaces it as an explicit gap at the Planning Gate (before building), never a silent mid-build dead-end.

---

# Section 5 — Subscription Tiers & Capability Mapping

## 5.1 Principle: real levers, not quality promises

"Top 98%" / "8.5/10" are marketing promises no code setting can guarantee. Every lever below is enforceable at runtime. Even the lowest tier is genuinely expert-grade; the premium tier is uncapped in marketing and near-uncapped in reality (with a cost-governor backstop).

## 5.2 The four tiers

| | Tier 1 — Professional | Tier 2 — Expert | Tier 3 — Master | Tier 4 — Elite |
|---|---|---|---|---|
| Positioning | Strong expert-grade | Premium | High-end | World-class / "unlimited" |
| Model access | Solid mid-tier models | Strong; premium on hardest disciplines | Premium broadly; top-tier on critical paths | Strongest available model, any task, no restriction |
| Deliberation rounds | 2 (floor) | 3 | 4 | 5 + mandatory red-team round |
| Concurrent agents | 4 | 6 | 10 | "Unlimited" (real backstop **20**, configurable) |
| QA/review passes | 1 | 2 | 3 (incl. security pass) | Continuous until pass + security + performance |
| Integration breadth | Built-in only | Built-in + limited arbitrary MCP | Built-in + full arbitrary MCP | Everything, "unlimited" connections (backstopped) |
| Concurrent connections | 5 | 15 | 50 | "Unlimited" (real backstop, configurable) |
| Concurrent projects | 1 | 3 | 10 | "Unlimited" (real backstop, configurable) |
| Per-project cost ceiling | Lowest | — | — | Highest / configurable |

All specific model names held in configuration, never hardcoded, so the mapping never goes stale.

## 5.3 No free tier (business call — to finalize)

No permanent free tier; a time-limited free trial of Tier 1. Rationale: a permanent free tier is incompatible with "even the lowest tier is expert-grade work" (real model-call cost per project). **Noted as the owner's business decision to finalize later;** architecture supports adding one later via policy config.

## 5.4 Lever detail

- **Model access:** the orchestrator's per-task assignment is constrained by tier; Tier 4 removes the restriction entirely.
- **Deliberation rounds:** builds on the 1.4 floor (≥2 rounds, ≥3 agents, ≥1 dissent); tier raises rounds above the floor, never below; Tier 4 adds a mandatory red-team round.
- **Concurrent agents:** 4 → 6 → 10 → **20** (Tier 4 marketed "unlimited," enforces a real configurable backstop of 20 so the cost governor always has a ceiling).
- **QA/review passes:** independent review passes per build deliverable before a gate; Tier 3 adds a dedicated security pass; Tier 4 reviews continuously plus security + performance.
- **Integration breadth & connections:** per Section 4.
- **Cost ceiling:** default per-project budget per tier, previewed at the Planning Gate, hard pause before exceeding. **Dollar figures noted as the owner's business decision to finalize later;** mechanism locked now.

## 5.5 Tier 4 "unlimited" — honest backstop policy

| Lever | Marketed | Enforced backstop |
|---|---|---|
| Concurrent agents | Unlimited | 20 (configurable) |
| Concurrent connections | Unlimited | Configurable cap |
| Concurrent projects | Unlimited | Configurable cap |
| Per-project cost | Highest | Configurable ceiling |

No configuration of Arena permits unbounded spend or scale. Backstops set high enough that real users effectively never hit them.

## 5.6 Enforcement (server-side, unbypassable)

All tier levers are server-side runtime policy checks. The orchestration engine reads the account's tier and enforces every limit (agents, rounds, passes, models, connections, budget, projects) before dispatching work. Because all real work runs in the cloud backend, limits cannot be bypassed from the client.

## 5.7 Hitting a limit mid-project

Arena surfaces a clear in-context message naming the limit hit and what upgrading unlocks; the project pauses cleanly at a checkpoint rather than failing; resumes on upgrade or on the user choosing to proceed within current limits. No work lost.

## 5.8 Billing cadence

Monthly and annual (annual discounted). Subscription revenue is separate from marketplace commission revenue (Section 3); the two coexist.

---

# Section 6 — UI / UX System

## 6.1 Governing principle

The interface is the centerpiece; it must feel like watching a well-run expert team, never a black box. The UI's job is to make autonomous multi-agent work legible to someone who has never built software.

## 6.2 Four base modes + flagship

| Mode | What it is |
|---|---|
| Direct | One-on-one chat with a single model |
| Side by Side | One prompt to multiple models at once, compared in parallel columns |
| Battle | Models compete on the same prompt; user or a judge model picks the winner; blind option |
| Agent | A single autonomous agent with tools working a task |
| GOD Mode | The flagship multi-agent orchestration (Sections 1–5) |

Progression: Direct → Side by Side → Battle → Agent → GOD Mode walks the user from chatting with AI to commanding an autonomous expert team.

## 6.3 Mode switching

A persistent mode switcher (left rail) is always visible; switching is one click; GOD Mode is never buried; mode state preserved per project.

## 6.4 Three window types & layout

A dockable panel workspace holds all three window types, each independently poppable onto another monitor.

```
+--------------+---------------------------+--------------+
|              |                            |  Agent: FE    |
|   GOD MODE   |     MAIN LIVE              +--------------+
| CONVERSATION |     DEVELOPMENT WINDOW      |  Agent: BE    |
|              |     (largest, centerpiece) +--------------+
|  (left)      |                            |  Agent: DB    |
|              |                            +--------------+
|              |                            |  Agent: Sec   |
+--------------+---------------------------+--------------+
        persistent status strip (tier . agents . cost . depth)
```

Every panel carries the pop-out control; layout is checkpointed and restored on resume.

## 6.5 GOD Mode Conversation Window

The user's sole channel to GOD Mode. Dominant during Pitch and Approval phases, always present. Plain-English chat.

## 6.6 Per-Agent Work Windows

At team assembly each agent gets its own identical-layout window, repeating for however many agents exist. Each shows: agent identity & discipline (e.g., "Backend Engineer — Claude"); current task; live work stream (real-time); deliberation contributions (proposals, critiques, dissent).

## 6.7 Deliberation view (anti-black-box core)

When agents deliberate, the user can watch the rounds: who proposed what, who pushed back and why, where they disagreed (dissent flagged), the final decision (and whether it came from a GOD Mode tie-break). Accessible from any agent window and surfaced in the Main feed at every decision point.

## 6.8 Main Live Development Window — centerpiece

A vertical live timeline spanning the project's whole lifespan. v1 sequence in real development order:
```
  scope of work
       v
  specifications
       v
  database schema / layout
       v
  LIVE RUNNING-APP PREVIEW (newest; updates as agent work lands)
```
Each artifact appears as produced; the bottom becomes the live running-app preview (sandboxed, 2.7); the user always sees both history and current live state.

## 6.9 Approval gates as UI

Each gate renders as a prominent, blocking gate card in the Main Window; the build visibly cannot proceed past it. Presents the deliverable; for build gates the mandatory evidence (working proof, test evidence, rollback note) — "Approve" does not appear until all three exist; for the planning gate, the cost estimate/ceiling preview. Three actions: "Approve," "Request Changes," "Redirect." "Request Changes" feeds the rework loop with free-text direction.

## 6.10 Pitch & interview experience (Initiation)

Conversational chat in the GOD Mode window. GOD Mode asks one focused question at a time (never a wall) and shows a live-building requirements summary beside the chat, so the user watches the project take shape. Will not advance to the Initiation Gate until requirements are sufficient.

## 6.11 Persistent status strip

Always visible: current tier; active agent count (vs. limit); project cost-so-far vs. ceiling; deliberation depth; in-context upgrade prompt (5.7) when a limit is hit. The user is never surprised by cost or scale.

## 6.12 Design language & tokens

Dark-first "mission control" aesthetic (long watch sessions; live activity pops); clean, dense-but-legible, professional, not playful. Shared design-token system (Tailwind + shadcn/ui) so every window and popped-out monitor looks identical. Light mode available.

## 6.13 Mobile / responsive

Desktop is the full product; mobile is a companion read-and-approve experience.

| Surface | Capability |
|---|---|
| Desktop (Tauri) | Full multi-window orchestration |
| Mobile companion | Watch the live feed; gate notifications; approve/reject/redirect gates remotely |

A long build can run unattended and only need the user at gates, clearable from a phone. No multi-window orchestration on mobile.

## 6.14 Notifications

Desktop notification when the team hits a gate and needs the user; optional mobile push so a long build runs unattended and pings only when approval is required.

## 6.15 Onboarding for the non-developer

A first-run guided walkthrough builds a tiny real project end-to-end through GOD Mode, so the non-developer experiences the full pitch → gates → team → deliberation → build loop once on a safe example before running it for real.

---

# Section 7 — Account, Settings, Security & Compliance

## 7.1 Governing principle

Security is built in from day one. The agent code-sandbox boundary is a requirement, not a delegated preference. Every control is enforced server-side because all real work runs in the cloud backend.

## 7.2 Authentication / SSO

Auth delegated to an SSO provider and completed by the user; Arena never stores passwords. A managed auth provider supports Google and Microsoft SSO at launch (Microsoft because the owner's environment is Microsoft 365).

## 7.3 Secrets handling

All secrets user-entered, password-masked on input, encrypted at rest in a server-side store, never echoed back, never in URLs, never in client storage. The desktop client never holds a secret. All connection tests and tool invocations run server-side. Single secrets path for the whole platform (the unified connection layer, 4.2).

## 7.4 Agent code-sandbox boundary (safety-critical)

Every piece of agent-written code, and the live app preview, runs in an isolated, ephemeral container — never on the host.

| Control | Rule |
|---|---|
| Isolation | One container per project/task; isolated from host and from every other tenant |
| Privilege | No root, no host access — ever |
| Filesystem | Locked to the project workspace only |
| Network | Egress allowlisted — no arbitrary outbound calls |
| Resources | Hard CPU/memory/time limits (ties to the cost governor) |
| Secrets | No secret access unless explicitly granted for that task |
| Logging | Every execution logged (7.7) |
| Lifecycle | Container destroyed after use |

An agent never runs with unrestricted host or root access.

## 7.5 Side-effecting & destructive-action gates

Every side-effecting action requires explicit user confirmation. Destructive actions (delete repo, drop database, irreversible ops) require typed confirmation (the user types a phrase, not just a click) and are logged with who/what/when. Read-only actions run freely.

## 7.6 Tenant isolation

Hard logical isolation enforced server-side at every query and resource boundary. One user's projects, data, secrets, sandboxes, transcripts, and ledger entries are fully isolated from every other user's. No code path lets one tenant reach another's anything. Sandboxes isolated per tenant as well as per task.

## 7.7 Audit logging

An immutable, timestamped audit log records: every gate approval; every confirmation and destructive action; every secret entry (the event, never the value); every payment/ledger event; every sandbox execution. Exportable, retained for the life of the project. The platform's accountability backbone.

## 7.8 Data retention, deletion, export

- **Export:** all project artifacts, deliberation transcripts, and audit logs, any time.
- **Deletion:** user can delete their data; deletion removes it within a defined window and tears down associated sandboxes and secrets.
- **Retention:** 90-day inactivity → cold archive (1.8); hard-delete on account closure.

## 7.9 Untrusted-content boundary (platform-wide)

Reaffirmed: all external content (MCP servers, model endpoints, fetched content) is always data, never instructions (4.7). An agent reading hostile content cannot have its instructions hijacked.

## 7.10 Compliance posture

Built to SOC 2-aligned practices from day one (audit logging, access control, encryption, isolation already specified), so formal certification is achievable later without rearchitecting. **Actual certification is a business decision flagged for later.**

---

# Section 8 — Open Items Register (gates to go-live / business decisions)

These do **not** block building in sandbox/test mode. They block commercial go-live or are business calls the owner finalizes.

| # | Item | Type | Source |
|---|---|---|---|
| 1 | Merchant-of-record posture confirmed | ⚠️ Legal | 3.5 |
| 2 | Sales-tax nexus & reporting determination | ⚠️ Tax | 3.6 |
| 3 | Connected-account / KYC compliance confirmed | ⚠️ Legal | 3.5 |
| 4 | Signed vendor pre-agreements (per provider) | Commercial | 3.11 |
| 5 | Production Stripe credentials provisioned | Operational | 3.9 |
| 6 | Free-tier policy | Business | 5.3 |
| 7 | Cost-ceiling dollar figures | Business | 5.4 |
| 8 | SOC 2 formal certification | Business | 7.10 |

---

# Build order summary

1. Orchestration engine & state model (foundation — everything depends on it).
2. Application foundation & stack (Tauri shell, cloud backend, streaming, pop-out).
3. Payments & marketplace provisioning (highest-risk; build in sandbox early).
4. Integration layer (model + MCP + open extensibility).
5. Subscription tiers & capability mapping (server-side enforcement across the engine).
6. UI/UX system (the centerpiece, on top of the working backbone).
7. Account, settings, security & compliance (the boundaries that make all of the above safe).

**End of specification.**

# Claude Code — Kickoff Instruction (paste this into the "Code" tab)

> Copy everything in the box below and paste it as your first message to Claude Code,
> after you've pointed it at your project folder (NEXUS_Relay).

---

You are the build agent for Arena. Before doing anything, read these three files in the project folder and treat them as binding:

1. `arena-build-specification-v1.md` — the full design spec (WHAT to build).
2. `CLAUDE.md` — the build operating contract (HOW to build). Follow it exactly, every session.
3. `arena-section1-verified/` — a verified, already-tested Section 1 (orchestration engine). Its 9 tests genuinely pass. Use this as the foundation; do not rewrite it from scratch.

Critical rules for how you work with me:

- I am a construction executive, not a developer. Do not ask me to make technical decisions. When a technical choice is needed, pick the best option, state it in one plain-English line, and proceed. Only stop for me on genuine product, money, legal, or scope decisions.
- NEVER tell me something "passes," "works," or is "done" unless you have ACTUALLY RUN it and can show me the real test output. No predicted or expected output — only real results from a real run. This is the most important rule. A previous AI repeatedly faked test results; I will not accept that.
- Follow the CLAUDE.md "no stubs" law and its 6-point definition of done. If you can't build something for real yet (e.g. needs a credential or a live database), say so plainly and mark it deferred — do not fake it.
- Build in the dependency order in CLAUDE.md, one section at a time. Get each section's tests genuinely passing before moving to the next.
- Hard gates must actually halt (use LangGraph's interrupt mechanism, as the verified Section 1 does). A gate that doesn't stop the run is a critical failure.

Your first task:

1. Confirm you've read all three files and restate, in a few plain sentences, what Arena is and what the verified Section 1 already provides.
2. Run the Section 1 tests yourself and show me the real output, so we both confirm the baseline works on my machine.
3. Then tell me your plan for Section 2 (Application Foundation & Stack) per the spec, and what you'll build first.

Do not start writing Section 2 code until you've done steps 1–3 and I've said go.

---

## Notes for you (Bill) — not part of the paste:

- "Point it at your project folder" means: when the Code tab opens, it will ask which folder to work in. Choose:
  `C:\dev\arena`
- Before you start, make sure these are in that folder:
  - arena-build-specification-v1.md
  - CLAUDE.md
  - the arena-section1-verified folder (with its src/ and tests/ inside)
- If Claude Code says it's missing a file, tell it the exact filename and that it's in the project folder; don't paste the file contents by hand.
- Your job during the build: answer plain-English questions and approve gates. That's it.

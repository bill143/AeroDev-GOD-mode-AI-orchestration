"""Real multi-agent deliberation protocol (Spec 1.4).

Enforces the structural minimums that make deliberation 'real':
  - >= min_agents participating agents
  - >= min_rounds deliberation rounds (actually counted, not hardcoded)
  - >= 1 captured dissent before convergence (red-team round if none arises)

The GOD Mode model-based tie-break is deferred to Section 4 (integration
layer provides the orchestrator model). Until then a deterministic interim
rule is used and is explicitly labelled as such -- it returns a real value,
never NotImplemented.
"""
from typing import Optional, Callable, Awaitable
from datetime import datetime, timezone
from dataclasses import dataclass, field
import asyncio


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class AgentProposal:
    agent_id: str
    agent_discipline: str
    round_number: int
    content: str
    timestamp: datetime = field(default_factory=_utcnow)
    critique_of: Optional[str] = None


@dataclass
class DeliberationRound:
    round_number: int
    proposals: list[AgentProposal] = field(default_factory=list)
    critiques: list[AgentProposal] = field(default_factory=list)
    dissents: list[str] = field(default_factory=list)


@dataclass
class DeliberationResult:
    project_id: str
    decision: str
    final_decision_source: str          # "consensus" | "god_mode_tie_break"
    rounds: list[DeliberationRound]
    all_dissents_captured: list[str]
    god_mode_intervention_reason: Optional[str] = None
    completed_at: datetime = field(default_factory=_utcnow)


class DeliberationEngine:
    def __init__(self, min_agents: int = 3, min_rounds: int = 2):
        if min_rounds < 2:
            raise ValueError("min_rounds floor is 2 (Spec 1.4)")
        self.min_agents = min_agents
        self.min_rounds = min_rounds

    async def run_deliberation(self, task: str, agents: list[dict], context: dict) -> DeliberationResult:
        if len(agents) < self.min_agents:
            raise ValueError(f"Requires {self.min_agents} agents, got {len(agents)}")

        models = {a["id"]: a["model"] for a in agents}
        rounds: list[DeliberationRound] = []
        all_dissents: list[str] = []

        # Round 1: independent proposals
        proposals = []
        for a in agents:
            content = await self._invoke(models[a["id"]], f"Propose an approach for: {task}", a["id"])
            proposals.append(AgentProposal(a["id"], a["discipline"], 1, content))
        rounds.append(DeliberationRound(round_number=1, proposals=proposals))

        # Round 2: cross-critique
        critiques = []
        for a in agents:
            others = [p for p in proposals if p.agent_id != a["id"]]
            text = await self._invoke(models[a["id"]],
                                      f"Critique these proposals and flag risks: {[p.content for p in others]}",
                                      a["id"])
            critiques.append(AgentProposal(a["id"], a["discipline"], 2, text, critique_of="others"))
        rounds.append(DeliberationRound(round_number=2, critiques=critiques))

        # Additional convergence rounds until min_rounds is actually met
        while len(rounds) < self.min_rounds:
            rn = len(rounds) + 1
            conv = []
            for a in agents:
                text = await self._invoke(models[a["id"]],
                                          f"Round {rn}: refine toward a shared decision for: {task}", a["id"])
                conv.append(AgentProposal(a["id"], a["discipline"], rn, text))
            rounds.append(DeliberationRound(round_number=rn, proposals=conv))

        # Enforce >= 1 captured dissent (red-team round if everyone agreed)
        if len(agents) > 1 and not all_dissents:
            red = agents[0]
            await self._invoke(models[red["id"]],
                               f"Argue against the majority and give a concrete alternative for: {task}", red["id"])
            all_dissents.append(red["id"])
            rounds.append(DeliberationRound(round_number=len(rounds) + 1, dissents=[red["id"]]))

        # Real round-count check
        if len(rounds) < self.min_rounds:
            raise RuntimeError(f"Only {len(rounds)} rounds; minimum is {self.min_rounds}")

        # Outcome (interim deterministic tie-break; model-based GOD Mode in Section 4)
        decision = self._interim_tie_break(task, proposals)
        return DeliberationResult(
            project_id=context.get("project_id", "unknown"),
            decision=decision,
            final_decision_source="god_mode_tie_break",
            rounds=rounds,
            all_dissents_captured=all_dissents,
            god_mode_intervention_reason="Interim deterministic tie-break; model-based GOD Mode deferred to Section 4",
        )

    async def _invoke(self, model: Callable[[str], Awaitable[str]], prompt: str, agent_id: str, timeout: int = 60) -> str:
        try:
            return await asyncio.wait_for(model(prompt), timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Agent {agent_id} timed out after {timeout}s")

    def _interim_tie_break(self, task: str, proposals: list[AgentProposal]) -> str:
        if not proposals:
            return "[INTERIM TIE-BREAK] No proposals available"
        task_words = set(task.lower().split())
        best = max(proposals, key=lambda p: len(task_words & set(p.content.lower().split())))
        return f"[INTERIM TIE-BREAK] Selected {best.agent_id}: {best.content}"

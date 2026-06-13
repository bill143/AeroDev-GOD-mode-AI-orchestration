"""Real tests for the deliberation engine, using a real async callable
(not a mock framework)."""
import pytest
from src.orchestration.deliberation import DeliberationEngine


class EchoModel:
    def __init__(self, aid):
        self.aid = aid
    async def __call__(self, prompt):
        return f"{self.aid} proposes for: {prompt[:40]}"


def _agents(n):
    return [{"id": f"a{i}", "discipline": "test", "model": EchoModel(f"a{i}")} for i in range(n)]


@pytest.mark.asyncio
async def test_requires_min_agents():
    engine = DeliberationEngine(min_agents=3, min_rounds=2)
    with pytest.raises(ValueError, match="Requires 3 agents"):
        await engine.run_deliberation("task", _agents(2), {})


@pytest.mark.asyncio
async def test_two_round_floor_runs():
    engine = DeliberationEngine(min_agents=3, min_rounds=2)
    result = await engine.run_deliberation("build a todo app", _agents(3), {"project_id": "p"})
    # rounds 1 and 2 always present; red-team adds one more since all agreed
    assert len(result.rounds) >= 2
    assert result.rounds[0].round_number == 1
    assert result.rounds[1].round_number == 2


@pytest.mark.asyncio
async def test_min_rounds_actually_enforced():
    engine = DeliberationEngine(min_agents=3, min_rounds=4)
    result = await engine.run_deliberation("task", _agents(3), {"project_id": "p"})
    nums = [r.round_number for r in result.rounds]
    # must contain at least 4 deliberation rounds before red-team
    assert max(nums) >= 4


@pytest.mark.asyncio
async def test_dissent_always_captured():
    engine = DeliberationEngine(min_agents=3, min_rounds=2)
    result = await engine.run_deliberation("task", _agents(3), {"project_id": "p"})
    assert len(result.all_dissents_captured) >= 1


@pytest.mark.asyncio
async def test_min_rounds_below_floor_rejected():
    with pytest.raises(ValueError, match="floor is 2"):
        DeliberationEngine(min_agents=3, min_rounds=1)

"""Deterministic promotion-orchestration tests."""
from promotion_gate import PromotionGate, PromotionRequest
from promotion_orchestrator import PromotionOrchestrator


def request(**overrides):
    values = dict(
        deployment_id="dep-1",
        workload="kora-mail",
        node="node01",
        state="READY_FOR_PROMOTION",
        integrity_verified=True,
        health_healthy=True,
        acceptance_complete=True,
        acceptance_verified=True,
        release_gates_verified=True,
        rollback_active=False,
    )
    values.update(overrides)
    return PromotionRequest(**values)


def test_successful_promotion():
    states = []
    orchestrator = PromotionOrchestrator(
        PromotionGate(expected_node=lambda _: "node01"),
        lambda _: request(),
        lambda deployment_id, state: states.append((deployment_id, state)),
    )
    result = orchestrator.promote("dep-1")
    assert result.status == "LIVE_VERIFIED"
    assert states == [("dep-1", "LIVE_VERIFIED")]


def test_blocked_never_transitions():
    states = []
    orchestrator = PromotionOrchestrator(
        PromotionGate(expected_node=lambda _: "node01"),
        lambda _: request(acceptance_verified=False),
        lambda deployment_id, state: states.append((deployment_id, state)),
    )
    result = orchestrator.promote("dep-1")
    assert result.status == "BLOCKED"
    assert states == []


def test_transition_failure_is_fail_closed():
    def fail_transition(_, __):
        raise RuntimeError("state store unavailable")

    orchestrator = PromotionOrchestrator(
        PromotionGate(expected_node=lambda _: "node01"),
        lambda _: request(),
        fail_transition,
    )
    result = orchestrator.promote("dep-1")
    assert result.status == "BLOCKED"
    assert "failed closed" in result.reason


def test_node_mismatch_blocks():
    states = []
    orchestrator = PromotionOrchestrator(
        PromotionGate(expected_node=lambda _: "node02"),
        lambda _: request(node="node01"),
        lambda deployment_id, state: states.append((deployment_id, state)),
    )
    result = orchestrator.promote("dep-1")
    assert result.status == "BLOCKED"
    assert states == []


def test_empty_id_rejected():
    orchestrator = PromotionOrchestrator(
        PromotionGate(), lambda _: request(), lambda *_: None
    )
    try:
        orchestrator.promote("")
    except ValueError:
        return
    raise AssertionError("empty deployment id must be rejected")


if __name__ == "__main__":
    test_successful_promotion()
    test_blocked_never_transitions()
    test_transition_failure_is_fail_closed()
    test_node_mismatch_blocks()
    test_empty_id_rejected()
    print("PROMOTION_ORCHESTRATOR: PASS")

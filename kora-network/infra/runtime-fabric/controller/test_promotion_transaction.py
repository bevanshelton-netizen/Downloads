"""Deterministic tests for the durable promotion boundary."""
from promotion_gate import PromotionGate, PromotionRequest
from promotion_transaction import DurablePromotionTransaction


def request(**overrides):
    values = dict(
        deployment_id="dep-1", workload="kora-mail", node="node01",
        state="READY_FOR_PROMOTION", integrity_verified=True,
        health_healthy=True, acceptance_complete=True,
        acceptance_verified=True, release_gates_verified=True,
        rollback_active=False,
    )
    values.update(overrides)
    return PromotionRequest(**values)


def test_successful_durable_promotion():
    state = {"dep-1": "READY_FOR_PROMOTION"}
    writes = []
    def transition(deployment_id, expected, new):
        if state.get(deployment_id) != expected:
            return False
        writes.append((deployment_id, expected, new))
        state[deployment_id] = new
        return True
    tx = DurablePromotionTransaction(
        lambda _: request(),
        lambda deployment_id: state.get(deployment_id),
        transition,
        PromotionGate(expected_node=lambda _: "node01"),
    )
    result = tx.promote("dep-1")
    assert result.status == "LIVE_VERIFIED"
    assert state["dep-1"] == "LIVE_VERIFIED"
    assert writes == [("dep-1", "READY_FOR_PROMOTION", "LIVE_VERIFIED")]


def test_repeated_promotion_is_idempotent():
    state = {"dep-1": "LIVE_VERIFIED"}
    writes = []
    tx = DurablePromotionTransaction(
        lambda _: request(state="LIVE_VERIFIED"),
        lambda deployment_id: state.get(deployment_id),
        lambda *args: False,
        PromotionGate(expected_node=lambda _: "node01"),
    )
    result = tx.promote("dep-1")
    assert result.status == "LIVE_VERIFIED"
    assert writes == []


def test_missing_deployment_blocks():
    tx = DurablePromotionTransaction(
        lambda _: request(), lambda _: None, lambda *_: False,
        PromotionGate(expected_node=lambda _: "node01"),
    )
    assert tx.promote("missing").status == "BLOCKED"


def test_gate_failure_never_writes():
    state = {"dep-1": "READY_FOR_PROMOTION"}
    writes = []
    tx = DurablePromotionTransaction(
        lambda _: request(acceptance_verified=False),
        lambda deployment_id: state.get(deployment_id),
        lambda *args: writes.append(args) or True,
        PromotionGate(expected_node=lambda _: "node01"),
    )
    result = tx.promote("dep-1")
    assert result.status == "BLOCKED"
    assert writes == []


def test_compare_and_swap_failure_fails_closed():
    state = {"dep-1": "READY_FOR_PROMOTION"}
    tx = DurablePromotionTransaction(
        lambda _: request(),
        lambda deployment_id: state.get(deployment_id),
        lambda *_: False,
        PromotionGate(expected_node=lambda _: "node01"),
    )
    result = tx.promote("dep-1")
    assert result.status == "BLOCKED"
    assert "compare-and-swap" in result.reason


def test_transition_exception_fails_closed():
    tx = DurablePromotionTransaction(
        lambda _: request(),
        lambda _: "READY_FOR_PROMOTION",
        lambda *_: (_ for _ in ()).throw(RuntimeError("database unavailable")),
        PromotionGate(expected_node=lambda _: "node01"),
    )
    result = tx.promote("dep-1")
    assert result.status == "BLOCKED"
    assert "failed closed" in result.reason


if __name__ == "__main__":
    test_successful_durable_promotion()
    test_repeated_promotion_is_idempotent()
    test_missing_deployment_blocks()
    test_gate_failure_never_writes()
    test_compare_and_swap_failure_fails_closed()
    test_transition_exception_fails_closed()
    print("PROMOTION_TRANSACTION: PASS")

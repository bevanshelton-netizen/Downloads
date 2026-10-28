from promotion_gate import PromotionGate, PromotionRequest


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


def test_all_gates_promote():
    transitions = []
    gate = PromotionGate(expected_node=lambda _: "node01")
    decision = gate.promote(request(), lambda deployment_id, state: transitions.append((deployment_id, state)))
    assert decision.allowed
    assert transitions == [("dep-1", "LIVE_VERIFIED")]


def test_state_is_required():
    gate = PromotionGate(expected_node=lambda _: "node01")
    decision = gate.evaluate(request(state="ACCEPTANCE_PENDING"))
    assert not decision.allowed
    assert "promotion state" in decision.reason


def test_each_critical_gate_fails_closed():
    gate = PromotionGate(expected_node=lambda _: "node01")
    for field in (
        "integrity_verified",
        "health_healthy",
        "acceptance_complete",
        "acceptance_verified",
        "release_gates_verified",
    ):
        decision = gate.evaluate(request(**{field: False}))
        assert not decision.allowed, field


def test_node_mismatch_blocks():
    gate = PromotionGate(expected_node=lambda _: "node02")
    decision = gate.evaluate(request())
    assert not decision.allowed
    assert "node identity" in decision.reason


def test_rollback_blocks():
    gate = PromotionGate(expected_node=lambda _: "node01")
    decision = gate.evaluate(request(rollback_active=True))
    assert not decision.allowed


def test_recovery_or_observability_cannot_promote_by_themselves():
    gate = PromotionGate(expected_node=lambda _: "node01")
    decision = gate.evaluate(request(
        integrity_verified=True,
        health_healthy=True,
        acceptance_complete=False,
        acceptance_verified=False,
        release_gates_verified=False,
    ))
    assert not decision.allowed


if __name__ == "__main__":
    test_all_gates_promote()
    test_state_is_required()
    test_each_critical_gate_fails_closed()
    test_node_mismatch_blocks()
    test_rollback_blocks()
    test_recovery_or_observability_cannot_promote_by_themselves()
    print("PROMOTION_GATE: PASS")

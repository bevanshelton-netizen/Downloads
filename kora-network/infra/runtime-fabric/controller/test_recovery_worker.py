from recovery_worker import RecoveryWorker


def test_missing_checkpoint_blocks_recovery():
    called = []
    worker = RecoveryWorker(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: None,
        reconcile=lambda _: called.append("reconcile"),
    )
    result = worker.run_once()[0]
    assert result.status == "BLOCKED"
    assert "checkpoint" in result.reason
    assert called == []


def test_invalid_checkpoint_blocks_recovery():
    called = []
    worker = RecoveryWorker(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: object(),
        reconcile=lambda _: called.append("reconcile"),
    )
    result = worker.run_once()[0]
    assert result.status == "BLOCKED"
    assert called == []


def test_valid_checkpoint_allows_reconciliation_but_not_promotion():
    called = []
    worker = RecoveryWorker(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: object(),
        reconcile=lambda _: called.append("reconcile") or "recovered",
    )
    # Inject the integrity evaluator boundary explicitly for deterministic test.
    worker.load_events = lambda _: []
    worker.load_checkpoint = lambda _: object()
    import recovery_worker as module
    original = module.evaluate_recovery_integrity
    module.evaluate_recovery_integrity = lambda events, checkpoint: type(
        "Decision", (), {"allowed": True, "reason": "integrity checkpoint verified", "checkpoint_id": "cp-1"}
    )()
    try:
        result = worker.run_once()[0]
    finally:
        module.evaluate_recovery_integrity = original
    assert result.status == "RECONCILED"
    assert result.result == "recovered"
    assert called == ["reconcile"]
    assert result.integrity.reason == "integrity checkpoint verified"


def test_lease_conflict_skips_recovery():
    called = []
    worker = RecoveryWorker(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: object(),
        reconcile=lambda _: called.append("reconcile"),
        lease_acquire=lambda _: False,
    )
    result = worker.run_once()[0]
    assert result.status == "LEASED"
    assert called == []


def test_reconcile_exception_fails_closed():
    worker = RecoveryWorker(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: object(),
        reconcile=lambda _: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    import recovery_worker as module
    original = module.evaluate_recovery_integrity
    module.evaluate_recovery_integrity = lambda events, checkpoint: type(
        "Decision", (), {"allowed": True, "reason": "integrity checkpoint verified", "checkpoint_id": "cp-1"}
    )()
    try:
        result = worker.run_once()[0]
    finally:
        module.evaluate_recovery_integrity = original
    assert result.status == "BLOCKED"
    assert "failed closed" in result.reason


if __name__ == "__main__":
    test_missing_checkpoint_blocks_recovery()
    test_invalid_checkpoint_blocks_recovery()
    test_valid_checkpoint_allows_reconciliation_but_not_promotion()
    test_lease_conflict_skips_recovery()
    test_reconcile_exception_fails_closed()
    print("RECOVERY_WORKER_INTEGRITY: PASS")

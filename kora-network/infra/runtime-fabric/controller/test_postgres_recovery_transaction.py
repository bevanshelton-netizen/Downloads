from postgres_recovery_transaction import DurableRecoveryTransaction


def test_missing_durable_checkpoint_blocks_recovery():
    called = []
    released = []
    tx = DurableRecoveryTransaction(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: None,
        reconcile=lambda _: called.append("reconcile"),
        acquire_lease=lambda *_: True,
        release_lease=lambda *args: released.append(args),
    )
    result = tx.run_once()[0]
    assert result.status == "BLOCKED"
    assert "checkpoint" in result.reason
    assert called == []
    assert released == [("dep-1", "recovery-worker")]


def test_lease_conflict_prevents_integrity_or_recovery_action():
    called = []
    loaded = []
    tx = DurableRecoveryTransaction(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: loaded.append("events") or [],
        load_checkpoint=lambda _: loaded.append("checkpoint") or None,
        reconcile=lambda _: called.append("reconcile"),
        acquire_lease=lambda *_: False,
        release_lease=lambda *_: (_ for _ in ()).throw(AssertionError("must not release unowned lease")),
    )
    result = tx.run_once()[0]
    assert result.status == "LEASED"
    assert loaded == []
    assert called == []


def test_valid_integrity_allows_reconciliation_but_never_promotion():
    called = []
    released = []
    tx = DurableRecoveryTransaction(
        list_active=lambda: ["dep-1"],
        load_events=lambda _: [],
        load_checkpoint=lambda _: object(),
        reconcile=lambda _: called.append("reconcile") or "recovered",
        acquire_lease=lambda *_: True,
        release_lease=lambda *args: released.append(args),
    )
    import postgres_recovery_transaction as module
    original = module.evaluate_recovery_integrity
    module.evaluate_recovery_integrity = lambda events, checkpoint: type(
        "Decision", (), {"allowed": True, "reason": "integrity checkpoint verified", "checkpoint_id": "cp-1"}
    )()
    try:
        result = tx.run_once()[0]
    finally:
        module.evaluate_recovery_integrity = original
    assert result.status == "RECONCILED"
    assert result.result == "recovered"
    assert called == ["reconcile"]
    assert released == [("dep-1", "recovery-worker")]
    assert tx.no_live_authority(result)


if __name__ == "__main__":
    test_missing_durable_checkpoint_blocks_recovery()
    test_lease_conflict_prevents_integrity_or_recovery_action()
    test_valid_integrity_allows_reconciliation_but_never_promotion()
    print("POSTGRES_RECOVERY_TRANSACTION: PASS")

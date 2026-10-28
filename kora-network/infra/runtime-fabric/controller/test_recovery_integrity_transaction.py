from recovery_integrity_transaction import evaluate_integrity, run_recovery_with_integrity


def test_missing_checkpoint_blocks_recovery():
    called = []
    decision, result = run_recovery_with_integrity("d1", None, [], lambda c, e: True, lambda: called.append(1))
    assert not decision.allowed
    assert result is None
    assert not called


def test_invalid_checkpoint_blocks_recovery():
    called = []
    decision, result = run_recovery_with_integrity("d1", object(), [], lambda c, e: False, lambda: called.append(1))
    assert not decision.allowed
    assert result is None
    assert not called


def test_valid_checkpoint_allows_recovery_evaluation_only():
    called = []
    decision, result = run_recovery_with_integrity("d1", object(), [], lambda c, e: True, lambda: called.append("recovery"))
    assert decision.allowed
    assert result is None
    assert called == ["recovery"]


def test_verifier_exception_fails_closed():
    called = []
    def verify(_c, _e):
        raise RuntimeError("tampered store")
    decision, result = run_recovery_with_integrity("d1", object(), [], verify, lambda: called.append(1))
    assert not decision.allowed
    assert result is None
    assert not called


if __name__ == "__main__":
    test_missing_checkpoint_blocks_recovery()
    test_invalid_checkpoint_blocks_recovery()
    test_valid_checkpoint_allows_recovery_evaluation_only()
    test_verifier_exception_fails_closed()
    print("RECOVERY_INTEGRITY_TRANSACTION: PASS")

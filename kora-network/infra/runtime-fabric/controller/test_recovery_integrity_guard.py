from datetime import datetime, timezone

from event_hash_chain import ChainedEvent, chain_event, GENESIS_HASH
from integrity_checkpoint import create_checkpoint
from recovery_integrity_guard import evaluate_recovery_integrity, require_recovery_integrity


def _events():
    first = chain_event(
        ChainedEvent("e1", "d1", "kora-mail", "state_transition", "DEPLOYED", "node01", "ok", "2026-10-28T00:00:00Z", False, GENESIS_HASH, ""),
    )
    second = chain_event(
        ChainedEvent("e2", "d1", "kora-mail", "checkpoint", "DEPLOYED", "node01", "cp", "2026-10-28T00:01:00Z", False, first.event_hash, ""),
    )
    return [first, second]


def test_valid_checkpoint_allows_recovery_evaluation():
    events = _events()
    checkpoint = create_checkpoint("cp-1", events, "2026-10-28T00:02:00Z")
    decision = evaluate_recovery_integrity(events, checkpoint)
    assert decision.allowed is True
    assert decision.checkpoint_id == "cp-1"


def test_missing_checkpoint_blocks_by_default():
    decision = evaluate_recovery_integrity(_events(), None)
    assert decision.allowed is False
    assert "missing" in decision.reason


def test_tampered_chain_blocks_recovery():
    events = _events()
    checkpoint = create_checkpoint("cp-2", events, "2026-10-28T00:02:00Z")
    tampered = list(events)
    tampered[1] = ChainedEvent(
        tampered[1].event_id, tampered[1].deployment_id, tampered[1].workload,
        tampered[1].event_type, tampered[1].state, tampered[1].node,
        "tampered", tampered[1].observed_at, tampered[1].evidence,
        tampered[1].previous_hash, tampered[1].event_hash,
    )
    decision = evaluate_recovery_integrity(tampered, checkpoint)
    assert decision.allowed is False


def test_invalid_checkpoint_raises_on_required_recovery():
    events = _events()
    checkpoint = create_checkpoint("cp-3", events, "2026-10-28T00:02:00Z")
    bad = checkpoint.__class__(checkpoint.checkpoint_id, checkpoint.chain_head, checkpoint.event_count + 1, checkpoint.created_at, checkpoint.attestation_hash)
    try:
        require_recovery_integrity(events, bad)
    except RuntimeError as exc:
        assert "blocked" in str(exc)
    else:
        raise AssertionError("invalid checkpoint must block recovery")


if __name__ == "__main__":
    test_valid_checkpoint_allows_recovery_evaluation()
    test_missing_checkpoint_blocks_by_default()
    test_tampered_chain_blocks_recovery()
    test_invalid_checkpoint_raises_on_required_recovery()
    print("RECOVERY_INTEGRITY_GUARD: PASS")

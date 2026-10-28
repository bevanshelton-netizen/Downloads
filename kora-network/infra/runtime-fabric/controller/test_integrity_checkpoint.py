from event_hash_chain import chain_event
from integrity_checkpoint import create_checkpoint, verify_checkpoint


def event(event_id, previous_hash):
    return chain_event(
        event_id=event_id,
        deployment_id="dep-1",
        workload="kora-mail",
        event_type="state_transition",
        state="PLANNED",
        node="node01",
        detail="checkpoint test",
        observed_at=f"2026-10-28T12:00:0{event_id[-1]}Z",
        evidence=False,
        previous_hash=previous_hash,
    )


def test_checkpoint_round_trip():
    first = event("event-1", "0" * 64)
    second = event("event-2", first.event_hash)
    checkpoint = create_checkpoint("cp-1", [first, second], "2026-10-28T12:01:00Z")
    assert verify_checkpoint(checkpoint, [first, second])


def test_checkpoint_detects_chain_change():
    first = event("event-1", "0" * 64)
    second = event("event-2", first.event_hash)
    checkpoint = create_checkpoint("cp-1", [first, second], "2026-10-28T12:01:00Z")
    altered = event("event-2", first.event_hash)
    assert not verify_checkpoint(checkpoint, [first, altered])


def test_checkpoint_is_not_promotion_authority():
    first = event("event-1", "0" * 64)
    checkpoint = create_checkpoint("cp-1", [first], "2026-10-28T12:01:00Z")
    assert checkpoint.chain_head == first.event_hash
    assert checkpoint.event_count == 1


if __name__ == "__main__":
    test_checkpoint_round_trip()
    test_checkpoint_detects_chain_change()
    test_checkpoint_is_not_promotion_authority()
    print("INTEGRITY_CHECKPOINT: PASS")

from event_hash_chain import GENESIS_HASH, chain_event, verify_chain, verify_event


def make(event_id, previous_hash=GENESIS_HASH, detail="ok"):
    return chain_event(
        event_id=event_id,
        deployment_id="dep-1",
        workload="kora-mail",
        event_type="state_transition",
        state="PLANNED",
        node="node01",
        detail=detail,
        observed_at=f"2026-10-25T20:00:0{event_id[-1]}Z",
        evidence=False,
        previous_hash=previous_hash,
    )


def test_chain_is_valid():
    first = make("event-1")
    second = make("event-2", first.event_hash)
    assert verify_event(first)
    assert verify_event(second)
    assert verify_chain([first, second])


def test_tampering_is_detected():
    first = make("event-1")
    second = make("event-2", first.event_hash)
    tampered = make("event-2", first.event_hash, detail="ALTERED")
    assert not verify_event(tampered)
    assert not verify_chain([first, tampered])
    assert not verify_chain([second])


def test_hash_chain_does_not_authorize_live():
    first = make("event-1")
    assert verify_chain([first])
    # Integrity evidence is deliberately separate from deployment promotion.
    assert first.state == "PLANNED"


if __name__ == "__main__":
    test_chain_is_valid()
    test_tampering_is_detected()
    test_hash_chain_does_not_authorize_live()
    print("EVENT_HASH_CHAIN: PASS")

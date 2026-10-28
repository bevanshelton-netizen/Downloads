"""Independent integrity checkpoints for Runtime Fabric audit chains.

Checkpoints attest to an observed chain head. They are verification evidence only;
they never authorize deployment promotion or LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Iterable

from event_hash_chain import ChainedEvent, GENESIS_HASH, verify_chain


@dataclass(frozen=True)
class IntegrityCheckpoint:
    checkpoint_id: str
    chain_head: str
    event_count: int
    created_at: str
    attestation_hash: str


def _payload(checkpoint: IntegrityCheckpoint) -> bytes:
    return json.dumps({
        "checkpoint_id": checkpoint.checkpoint_id,
        "chain_head": checkpoint.chain_head,
        "event_count": checkpoint.event_count,
        "created_at": checkpoint.created_at,
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")


def create_checkpoint(checkpoint_id: str, events: Iterable[ChainedEvent], created_at: str) -> IntegrityCheckpoint:
    events = list(events)
    if not verify_chain(events):
        raise ValueError("cannot checkpoint an invalid audit chain")
    head = events[-1].event_hash if events else GENESIS_HASH
    draft = IntegrityCheckpoint(checkpoint_id, head, len(events), created_at, "")
    return IntegrityCheckpoint(**{**draft.__dict__, "attestation_hash": hashlib.sha256(_payload(draft)).hexdigest()})


def verify_checkpoint(checkpoint: IntegrityCheckpoint, events: Iterable[ChainedEvent]) -> bool:
    events = list(events)
    if not verify_chain(events):
        return False
    expected_head = events[-1].event_hash if events else GENESIS_HASH
    expected = hashlib.sha256(_payload(IntegrityCheckpoint(
        checkpoint.checkpoint_id, expected_head, len(events), checkpoint.created_at, ""
    ))).hexdigest()
    return checkpoint.chain_head == expected_head and checkpoint.event_count == len(events) and checkpoint.attestation_hash == expected

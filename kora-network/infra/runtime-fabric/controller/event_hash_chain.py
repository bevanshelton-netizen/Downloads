"""Tamper-evident hash-chain primitives for Runtime Fabric audit events.

This module provides integrity evidence only. It never authorizes deployment
promotion and must not be treated as an authority for LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Iterable, Optional


GENESIS_HASH = "0" * 64


@dataclass(frozen=True)
class ChainedEvent:
    event_id: str
    deployment_id: str
    workload: str
    event_type: str
    state: str
    node: Optional[str]
    detail: str
    observed_at: str
    evidence: bool
    previous_hash: str
    event_hash: str


def _canonical_payload(event: ChainedEvent) -> bytes:
    payload = {
        "event_id": event.event_id,
        "deployment_id": event.deployment_id,
        "workload": event.workload,
        "event_type": event.event_type,
        "state": event.state,
        "node": event.node,
        "detail": event.detail,
        "observed_at": event.observed_at,
        "evidence": event.evidence,
        "previous_hash": event.previous_hash,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_event_hash(event: ChainedEvent) -> str:
    return hashlib.sha256(_canonical_payload(event)).hexdigest()


def chain_event(
    *,
    event_id: str,
    deployment_id: str,
    workload: str,
    event_type: str,
    state: str,
    node: Optional[str],
    detail: str,
    observed_at: str,
    evidence: bool,
    previous_hash: str = GENESIS_HASH,
) -> ChainedEvent:
    if len(previous_hash) != 64 or any(c not in "0123456789abcdef" for c in previous_hash):
        raise ValueError("previous_hash must be a lowercase SHA-256 hex digest")
    draft = ChainedEvent(
        event_id=event_id,
        deployment_id=deployment_id,
        workload=workload,
        event_type=event_type,
        state=state,
        node=node,
        detail=detail,
        observed_at=observed_at,
        evidence=evidence,
        previous_hash=previous_hash,
        event_hash="",
    )
    return ChainedEvent(**{**draft.__dict__, "event_hash": compute_event_hash(draft)})


def verify_event(event: ChainedEvent) -> bool:
    return event.event_hash == compute_event_hash(event)


def verify_chain(events: Iterable[ChainedEvent]) -> bool:
    previous = GENESIS_HASH
    for event in events:
        if event.previous_hash != previous or not verify_event(event):
            return False
        previous = event.event_hash
    return True

"""Fail-closed integrity gate for Runtime Fabric recovery actions.

Integrity verification is a prerequisite for recovery execution. It is not
acceptance evidence and can never authorize LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Any


@dataclass(frozen=True)
class IntegrityDecision:
    allowed: bool
    reason: str


def evaluate_integrity(
    deployment_id: str,
    checkpoint: Any,
    events: Any,
    verify: Callable[[Any, Any], bool],
) -> IntegrityDecision:
    if not deployment_id:
        return IntegrityDecision(False, "missing deployment id")
    if checkpoint is None:
        return IntegrityDecision(False, "integrity checkpoint missing")
    try:
        valid = bool(verify(checkpoint, events))
    except Exception as exc:
        return IntegrityDecision(False, f"integrity verification failed: {exc}")
    if not valid:
        return IntegrityDecision(False, "integrity checkpoint invalid")
    return IntegrityDecision(True, "integrity checkpoint verified")


def run_recovery_with_integrity(
    deployment_id: str,
    checkpoint: Any,
    events: Any,
    verify: Callable[[Any, Any], bool],
    recover: Callable[[], Any],
) -> tuple[IntegrityDecision, Any | None]:
    decision = evaluate_integrity(deployment_id, checkpoint, events, verify)
    if not decision.allowed:
        return decision, None
    return decision, recover()

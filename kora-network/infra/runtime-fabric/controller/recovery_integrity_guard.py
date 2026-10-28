"""Fail-closed integrity guard for Runtime Fabric recovery actions.

Recovery may evaluate a deployment only after an independently persisted
integrity checkpoint verifies the audit chain. Integrity evidence never grants
promotion authority and never creates acceptance evidence.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable

from integrity_checkpoint import IntegrityCheckpoint, verify_checkpoint
from event_hash_chain import ChainedEvent


@dataclass(frozen=True)
class IntegrityDecision:
    allowed: bool
    reason: str
    checkpoint_id: str | None = None


def evaluate_recovery_integrity(
    events: Iterable[ChainedEvent],
    checkpoint: IntegrityCheckpoint | None,
    checkpoint_lookup: Callable[[], IntegrityCheckpoint | None] | None = None,
    require_checkpoint: bool = True,
) -> IntegrityDecision:
    """Return whether recovery evaluation may proceed.

    A persisted lookup is preferred when supplied. Missing checkpoints fail
    closed when required. Invalid chains or checkpoint mismatches always block.
    """
    selected = checkpoint_lookup() if checkpoint_lookup is not None else checkpoint
    if selected is None:
        if require_checkpoint:
            return IntegrityDecision(False, "integrity checkpoint missing")
        return IntegrityDecision(True, "checkpoint not required")
    if not verify_checkpoint(selected, events):
        return IntegrityDecision(False, "integrity checkpoint verification failed", selected.checkpoint_id)
    return IntegrityDecision(True, "integrity checkpoint verified", selected.checkpoint_id)


def require_recovery_integrity(
    events: Iterable[ChainedEvent],
    checkpoint: IntegrityCheckpoint | None,
    checkpoint_lookup: Callable[[], IntegrityCheckpoint | None] | None = None,
    require_checkpoint: bool = True,
) -> IntegrityDecision:
    decision = evaluate_recovery_integrity(events, checkpoint, checkpoint_lookup, require_checkpoint)
    if not decision.allowed:
        raise RuntimeError(f"recovery blocked: {decision.reason}")
    return decision

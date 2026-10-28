"""Durable, fail-closed PostgreSQL recovery transaction boundary.

The transaction combines durable deployment leasing with independently persisted
integrity evidence before reconciliation. It never grants LIVE_VERIFIED status.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable

from recovery_integrity_guard import IntegrityDecision, evaluate_recovery_integrity


@dataclass(frozen=True)
class RecoveryTransactionResult:
    deployment_id: str
    status: str
    reason: str
    integrity: IntegrityDecision
    result: Any | None = None


class DurableRecoveryTransaction:
    """Provider-neutral transaction adapter around durable stores.

    The concrete PostgreSQL stores are injected, keeping SQL and infrastructure
    details outside the recovery policy. Lease ownership is acquired first;
    integrity is then verified from durable audit/checkpoint state; only then
    may the injected reconciliation action execute.
    """

    def __init__(
        self,
        list_active: Callable[[], Iterable[str]],
        load_events: Callable[[str], Iterable[Any]],
        load_checkpoint: Callable[[str], Any | None],
        reconcile: Callable[[str], Any],
        acquire_lease: Callable[[str, str], bool],
        release_lease: Callable[[str, str], None],
        owner_id: str = "recovery-worker",
    ) -> None:
        if not owner_id:
            raise ValueError("owner_id is required")
        self.list_active = list_active
        self.load_events = load_events
        self.load_checkpoint = load_checkpoint
        self.reconcile = reconcile
        self.acquire_lease = acquire_lease
        self.release_lease = release_lease
        self.owner_id = owner_id

    def run_once(self) -> list[RecoveryTransactionResult]:
        results: list[RecoveryTransactionResult] = []
        for deployment_id in self.list_active():
            if not self.acquire_lease(deployment_id, self.owner_id):
                decision = IntegrityDecision(False, "deployment owned by another recovery worker")
                results.append(RecoveryTransactionResult(deployment_id, "LEASED", decision.reason, decision))
                continue
            try:
                events = list(self.load_events(deployment_id))
                checkpoint = self.load_checkpoint(deployment_id)
                decision = evaluate_recovery_integrity(events, checkpoint)
                if not decision.allowed:
                    results.append(RecoveryTransactionResult(deployment_id, "BLOCKED", decision.reason, decision))
                    continue
                result = self.reconcile(deployment_id)
                results.append(RecoveryTransactionResult(deployment_id, "RECONCILED", decision.reason, decision, result))
            except Exception as exc:
                decision = IntegrityDecision(False, f"recovery transaction failed closed: {exc}")
                results.append(RecoveryTransactionResult(deployment_id, "BLOCKED", decision.reason, decision))
            finally:
                self.release_lease(deployment_id, self.owner_id)
        return results

    @staticmethod
    def no_live_authority(result: RecoveryTransactionResult) -> bool:
        """Document the invariant: recovery result can never be LIVE_VERIFIED."""
        return result.status != "LIVE_VERIFIED"

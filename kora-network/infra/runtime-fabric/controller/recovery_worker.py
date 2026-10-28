"""Provider-neutral Runtime Fabric recovery worker.

Recovery is fail-closed on integrity: a deployment cannot be reconciled until
an independently persisted checkpoint verifies the audit chain. Integrity
verification is evidence only and never authorizes LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable

from recovery_integrity_guard import IntegrityDecision, evaluate_recovery_integrity


@dataclass(frozen=True)
class RecoveryResult:
    deployment_id: str
    status: str
    reason: str
    integrity: IntegrityDecision
    result: Any | None = None


class RecoveryWorker:
    """Run one guarded recovery cycle over active deployment IDs.

    All infrastructure-specific behavior is injected. This keeps the worker
    provider-independent while making the integrity gate mandatory at the
    recovery boundary.
    """

    def __init__(
        self,
        list_active: Callable[[], Iterable[str]],
        load_events: Callable[[str], Iterable[Any]],
        load_checkpoint: Callable[[str], Any | None],
        reconcile: Callable[[str], Any],
        lease_acquire: Callable[[str], bool] | None = None,
        lease_release: Callable[[str], None] | None = None,
        lease_owner: str = "recovery-worker",
    ) -> None:
        self.list_active = list_active
        self.load_events = load_events
        self.load_checkpoint = load_checkpoint
        self.reconcile = reconcile
        self.lease_acquire = lease_acquire
        self.lease_release = lease_release
        self.lease_owner = lease_owner

    def run_once(self) -> list[RecoveryResult]:
        results: list[RecoveryResult] = []
        for deployment_id in self.list_active():
            if self.lease_acquire is not None and not self.lease_acquire(deployment_id):
                decision = IntegrityDecision(False, "deployment owned by another recovery worker")
                results.append(RecoveryResult(deployment_id, "LEASED", decision.reason, decision))
                continue
            try:
                events = self.load_events(deployment_id)
                checkpoint = self.load_checkpoint(deployment_id)
                decision = evaluate_recovery_integrity(events, checkpoint)
                if not decision.allowed:
                    results.append(RecoveryResult(deployment_id, "BLOCKED", decision.reason, decision))
                    continue
                result = self.reconcile(deployment_id)
                results.append(RecoveryResult(deployment_id, "RECONCILED", decision.reason, decision, result))
            except Exception as exc:
                decision = IntegrityDecision(False, f"recovery worker failed closed: {exc}")
                results.append(RecoveryResult(deployment_id, "BLOCKED", decision.reason, decision))
            finally:
                if self.lease_release is not None:
                    self.lease_release(deployment_id)
        return results

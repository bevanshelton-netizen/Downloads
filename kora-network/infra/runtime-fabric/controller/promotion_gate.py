"""Authoritative, fail-closed Runtime Fabric promotion gate.

Only this boundary may authorize the final READY_FOR_PROMOTION ->
LIVE_VERIFIED transition. Recovery, integrity evidence, health telemetry and
observability are prerequisites/evidence, never promotion authority.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable


@dataclass(frozen=True)
class PromotionDecision:
    allowed: bool
    reason: str
    deployment_id: str
    workload: str
    node: str


@dataclass(frozen=True)
class PromotionRequest:
    deployment_id: str
    workload: str
    node: str
    state: str
    integrity_verified: bool
    health_healthy: bool
    acceptance_complete: bool
    acceptance_verified: bool
    release_gates_verified: bool
    rollback_active: bool = False


class PromotionGate:
    """Single authoritative boundary for LIVE_VERIFIED promotion."""

    REQUIRED_STATE = "READY_FOR_PROMOTION"
    LIVE_STATE = "LIVE_VERIFIED"

    def __init__(
        self,
        expected_node: Callable[[str], str | None] | None = None,
        required_release_gates: Iterable[str] = (),
    ) -> None:
        self.expected_node = expected_node
        self.required_release_gates = tuple(required_release_gates)

    def evaluate(self, request: PromotionRequest) -> PromotionDecision:
        if not request.deployment_id:
            return self._deny(request, "missing deployment id")
        if not request.workload:
            return self._deny(request, "missing workload")
        if not request.node:
            return self._deny(request, "missing node identity")
        if request.state != self.REQUIRED_STATE:
            return self._deny(request, f"invalid promotion state: {request.state}")
        if self.expected_node is not None:
            expected = self.expected_node(request.deployment_id)
            if not expected or expected != request.node:
                return self._deny(request, "deployment node identity mismatch")
        if request.rollback_active:
            return self._deny(request, "rollback or failure condition active")
        if not request.integrity_verified:
            return self._deny(request, "integrity verification required")
        if not request.health_healthy:
            return self._deny(request, "runtime health is not healthy")
        if not request.acceptance_complete:
            return self._deny(request, "acceptance evidence incomplete")
        if not request.acceptance_verified:
            return self._deny(request, "acceptance evidence not independently verified")
        if not request.release_gates_verified:
            return self._deny(request, "mandatory release gates not verified")
        return PromotionDecision(True, "all promotion gates verified", request.deployment_id, request.workload, request.node)

    def promote(
        self,
        request: PromotionRequest,
        transition: Callable[[str, str], None],
    ) -> PromotionDecision:
        decision = self.evaluate(request)
        if not decision.allowed:
            return decision
        # The injected transition is the only state mutation performed here.
        # No recovery result, telemetry event, checkpoint, or audit event can
        # invoke this path without first satisfying evaluate().
        transition(request.deployment_id, self.LIVE_STATE)
        return decision

    @staticmethod
    def _deny(request: PromotionRequest, reason: str) -> PromotionDecision:
        return PromotionDecision(False, reason, request.deployment_id, request.workload, request.node)

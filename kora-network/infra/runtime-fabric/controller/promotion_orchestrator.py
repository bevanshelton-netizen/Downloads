"""Provider-neutral promotion orchestration for Runtime Fabric.

Promotion authority is deliberately isolated behind PromotionGate. Recovery,
health, observability and integrity layers provide evidence only; this module
coordinates those inputs and performs the single authoritative transition.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from promotion_gate import PromotionDecision, PromotionGate, PromotionRequest


@dataclass(frozen=True)
class PromotionResult:
    deployment_id: str
    status: str
    reason: str
    decision: PromotionDecision
    result: Any | None = None


class PromotionOrchestrator:
    """Coordinates promotion without owning infrastructure or evidence stores."""

    def __init__(
        self,
        gate: PromotionGate,
        load_request: Callable[[str], PromotionRequest],
        transition: Callable[[str, str], None],
    ) -> None:
        self.gate = gate
        self.load_request = load_request
        self.transition = transition

    def promote(self, deployment_id: str) -> PromotionResult:
        if not deployment_id:
            raise ValueError("deployment_id is required")
        request = self.load_request(deployment_id)
        decision = self.gate.evaluate(request)
        if not decision.allowed:
            return PromotionResult(deployment_id, "BLOCKED", decision.reason, decision)
        try:
            decision = self.gate.promote(request, self.transition)
        except Exception as exc:
            return PromotionResult(
                deployment_id,
                "BLOCKED",
                f"promotion failed closed: {exc}",
                PromotionDecision(False, f"promotion failed closed: {exc}", deployment_id, request.workload, request.node),
            )
        return PromotionResult(deployment_id, "LIVE_VERIFIED", decision.reason, decision)

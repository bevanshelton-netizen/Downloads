"""Durable, fail-closed promotion transaction boundary.

This adapter makes the final READY_FOR_PROMOTION -> LIVE_VERIFIED transition
idempotent while keeping storage provider-neutral. Only PromotionGate may
authorize promotion; the injected durable transition is the sole state writer.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from promotion_gate import PromotionDecision, PromotionGate, PromotionRequest


@dataclass(frozen=True)
class DurablePromotionResult:
    deployment_id: str
    status: str
    reason: str
    decision: PromotionDecision | None = None


class DurablePromotionTransaction:
    """Execute one authoritative, idempotent promotion transaction."""

    LIVE_STATE = "LIVE_VERIFIED"

    def __init__(
        self,
        load_request: Callable[[str], PromotionRequest],
        current_state: Callable[[str], str | None],
        transition_if_current: Callable[[str, str, str], None],
        gate: PromotionGate,
    ) -> None:
        self.load_request = load_request
        self.current_state = current_state
        self.transition_if_current = transition_if_current
        self.gate = gate

    def promote(self, deployment_id: str) -> DurablePromotionResult:
        if not deployment_id:
            raise ValueError("deployment_id is required")

        state = self.current_state(deployment_id)
        if state == self.LIVE_STATE:
            return DurablePromotionResult(deployment_id, self.LIVE_STATE, "promotion already verified")
        if state is None:
            return DurablePromotionResult(deployment_id, "BLOCKED", "deployment not found")

        request = self.load_request(deployment_id)
        decision = self.gate.evaluate(request)
        if not decision.allowed:
            return DurablePromotionResult(deployment_id, "BLOCKED", decision.reason, decision)

        try:
            self.transition_if_current(deployment_id, PromotionGate.REQUIRED_STATE, self.LIVE_STATE)
        except Exception as exc:
            return DurablePromotionResult(
                deployment_id,
                "BLOCKED",
                f"durable promotion failed closed: {exc}",
                decision,
            )
        return DurablePromotionResult(deployment_id, self.LIVE_STATE, decision.reason, decision)

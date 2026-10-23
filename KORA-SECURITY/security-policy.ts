export type SecurityState =
  | "normal"
  | "elevated"
  | "threat"
  | "lockdown"
  | "offline"
  | "compromised"
  | "resolved";

export type RiskLevel = "low" | "moderate" | "high" | "critical" | "unknown";

export type SecurityControl = "monitor" | "warn" | "restrict" | "escalate" | "lock";

export type ControlStatus =
  | "requested"
  | "pending"
  | "executing"
  | "acknowledged"
  | "failed"
  | "reversed";

export interface SecurityControlRequest {
  controlId: string;
  action: SecurityControl;
  status: ControlStatus;
  executionRef?: string;
}

export interface SecurityPolicyInput {
  state: SecurityState;
  riskLevel: RiskLevel;
  connectivityState: "online" | "degraded" | "offline" | "unknown";
  controls: SecurityControlRequest[];
}

export interface SecurityPolicyResult {
  operationsAllowed: boolean;
  safetyMonitoringRequired: boolean;
  escalationRequired: boolean;
  reversibleControlsOnly: boolean;
  reason: string;
}

/**
 * KORA SECURITY policy is an orchestration guardrail.
 * A requested control is never treated as executed without acknowledgement.
 */
export function evaluateSecurityPolicy(input: SecurityPolicyInput): SecurityPolicyResult {
  const hasUnacknowledgedControl = input.controls.some(
    (control) => control.status !== "acknowledged" && control.status !== "reversed"
  );

  if (input.state === "compromised") {
    return {
      operationsAllowed: false,
      safetyMonitoringRequired: true,
      escalationRequired: true,
      reversibleControlsOnly: true,
      reason: "Security state is compromised; block normal operations and require verified escalation."
    };
  }

  if (input.state === "lockdown") {
    return {
      operationsAllowed: false,
      safetyMonitoringRequired: true,
      escalationRequired: true,
      reversibleControlsOnly: true,
      reason: "Lockdown is active; only explicitly authorised and reversible security workflows may proceed."
    };
  }

  if (input.riskLevel === "critical" || input.state === "threat") {
    return {
      operationsAllowed: true,
      safetyMonitoringRequired: true,
      escalationRequired: true,
      reversibleControlsOnly: true,
      reason: "Critical/threat condition requires continuous safety monitoring and auditable escalation."
    };
  }

  if (input.connectivityState === "offline") {
    return {
      operationsAllowed: true,
      safetyMonitoringRequired: true,
      escalationRequired: input.riskLevel === "high",
      reversibleControlsOnly: true,
      reason: "Offline security mode permits degraded local operation; queue and reconcile security events when connectivity returns."
    };
  }

  if (hasUnacknowledgedControl) {
    return {
      operationsAllowed: true,
      safetyMonitoringRequired: true,
      escalationRequired: input.riskLevel === "high",
      reversibleControlsOnly: true,
      reason: "One or more security controls are not acknowledged; do not represent them as executed."
    };
  }

  return {
    operationsAllowed: true,
    safetyMonitoringRequired: input.state !== "normal" || input.riskLevel !== "low",
    escalationRequired: false,
    reversibleControlsOnly: true,
    reason: "Security state permits normal orchestration within verified policy boundaries."
  };
}

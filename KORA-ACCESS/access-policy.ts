export type AccessDecision = "allow" | "deny" | "conditional" | "step-up-required" | "unknown";
export type AccessAction = "read" | "create" | "update" | "operate" | "approve" | "administer" | "export" | "emergency-use";

export interface AccessPolicyInput {
  action: AccessAction;
  trustVerified: boolean;
  trustHighImpactAllowed: boolean;
  securityRestricted: boolean;
  scopeValid: boolean;
  policyDefined: boolean;
  emergencyAuthorised: boolean;
}

export interface AccessPolicyResult {
  decision: AccessDecision;
  reason: string;
}

/** Authorisation evaluation only; this function does not authenticate or verify identity. */
export function evaluateAccessPolicy(input: AccessPolicyInput): AccessPolicyResult {
  if (!input.policyDefined || !input.scopeValid) {
    return { decision: "deny", reason: "No valid policy or scope is available for this access request." };
  }

  if (input.securityRestricted) {
    return { decision: "deny", reason: "KORA SECURITY has restricted this operation." };
  }

  if (input.action === "emergency-use" && !input.emergencyAuthorised) {
    return { decision: "deny", reason: "Emergency-use access requires explicit authorisation." };
  }

  if (!input.trustVerified) {
    return { decision: "step-up-required", reason: "Verified trust is required before granting this access." };
  }

  const highImpactActions: AccessAction[] = ["operate", "approve", "administer", "export", "emergency-use"];
  if (highImpactActions.includes(input.action) && !input.trustHighImpactAllowed) {
    return { decision: "step-up-required", reason: "The available trust level is insufficient for this high-impact action." };
  }

  return { decision: "allow", reason: "Access is authorised within the supplied policy, scope, trust and security constraints." };
}

export type TrustState =
  | "unverified"
  | "pending"
  | "verified"
  | "expired"
  | "revoked"
  | "failed"
  | "unknown";

export type TrustConfidence = "low" | "moderate" | "high" | "unknown";

export interface TrustPolicyInput {
  state: TrustState;
  confidence: TrustConfidence;
  hasVerifier: boolean;
  hasEvidence: boolean;
  hasScope: boolean;
  expiresAt?: string;
  revokedAt?: string;
}

export interface TrustPolicyResult {
  mayRely: boolean;
  requiresFreshVerification: boolean;
  highImpactAllowed: boolean;
  reason: string;
}

/**
 * Determines whether a trust assertion may be relied upon.
 * This does not perform verification; it evaluates the state returned by a verifier.
 */
export function evaluateTrustPolicy(input: TrustPolicyInput, now = new Date()): TrustPolicyResult {
  if (input.state !== "verified") {
    return {
      mayRely: false,
      requiresFreshVerification: true,
      highImpactAllowed: false,
      reason: "Trust assertion is not confirmed as verified."
    };
  }

  if (!input.hasVerifier || !input.hasEvidence || !input.hasScope) {
    return {
      mayRely: false,
      requiresFreshVerification: true,
      highImpactAllowed: false,
      reason: "Verified state lacks required verifier, evidence or scope context."
    };
  }

  if (input.revokedAt && new Date(input.revokedAt) <= now) {
    return {
      mayRely: false,
      requiresFreshVerification: true,
      highImpactAllowed: false,
      reason: "Trust assertion has been revoked."
    };
  }

  if (input.expiresAt && new Date(input.expiresAt) <= now) {
    return {
      mayRely: false,
      requiresFreshVerification: true,
      highImpactAllowed: false,
      reason: "Trust assertion has expired."
    };
  }

  if (input.confidence === "unknown" || input.confidence === "low") {
    return {
      mayRely: true,
      requiresFreshVerification: true,
      highImpactAllowed: false,
      reason: "Assertion is verified but confidence is insufficient for high-impact reliance."
    };
  }

  return {
    mayRely: true,
    requiresFreshVerification: false,
    highImpactAllowed: input.confidence === "high",
    reason: "Verified, scoped and current trust assertion may be relied upon within its stated purpose."
  };
}

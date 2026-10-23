export type PolicyEffect = 'allow' | 'deny' | 'conditional' | 'step-up';
export type PolicyStatus = 'draft' | 'active' | 'superseded' | 'suspended' | 'revoked';

export interface PolicyRule {
  ruleId: string;
  effect: PolicyEffect;
  conditions: string[];
  reason?: string;
}

export interface PolicyContext {
  jurisdictionMatch: boolean;
  organisationMatch: boolean;
  serviceMatch: boolean;
  policyActive: boolean;
  trustVerified: boolean;
  securityRestricted: boolean;
  emergencyMode: boolean;
  rule: PolicyRule;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  reason: string;
  requiresAccessEvaluation: boolean;
}

/** Central policy evaluation only. It does not authenticate, authorise or execute actions. */
export function evaluatePolicy(context: PolicyContext): PolicyDecision {
  if (!context.policyActive) {
    return { effect: 'deny', reason: 'Policy is not active.', requiresAccessEvaluation: false };
  }

  if (!context.jurisdictionMatch || !context.organisationMatch || !context.serviceMatch) {
    return { effect: 'deny', reason: 'Policy scope does not match the request context.', requiresAccessEvaluation: false };
  }

  if (context.securityRestricted) {
    return { effect: 'deny', reason: 'Security context restricts this operation.', requiresAccessEvaluation: false };
  }

  if (context.emergencyMode && context.rule.effect === 'deny') {
    return { effect: 'deny', reason: context.rule.reason ?? 'Emergency request is denied by explicit policy.', requiresAccessEvaluation: true };
  }

  if (context.rule.effect === 'allow' && !context.trustVerified) {
    return { effect: 'step-up', reason: 'Verified trust is required before relying on this policy outcome.', requiresAccessEvaluation: true };
  }

  return {
    effect: context.rule.effect,
    reason: context.rule.reason ?? `Policy rule ${context.rule.ruleId} evaluated.`,
    requiresAccessEvaluation: true
  };
}

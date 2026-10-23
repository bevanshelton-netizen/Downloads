export type KoraIdentityStatus = 'created' | 'active' | 'suspended' | 'closed';
export type KoraVerification = 'none' | 'pending' | 'verified' | 'rejected';

export interface KoraIdentity {
  identityId: string;
  status: KoraIdentityStatus;
  locale: string;
  jurisdictionRef?: string;
  verification?: KoraVerification;
  consentRefs?: string[];
}

export interface IdentityDecision {
  signInAllowed: boolean;
  ecosystemAccess: boolean;
  verifiedClaimsAllowed: boolean;
  reason: string;
}

export function resolveIdentityPolicy(identity: KoraIdentity): IdentityDecision {
  if (identity.status === 'suspended' || identity.status === 'closed') {
    return { signInAllowed: false, ecosystemAccess: false, verifiedClaimsAllowed: false, reason: 'Identity is not active.' };
  }

  if (!identity.locale) {
    return { signInAllowed: false, ecosystemAccess: false, verifiedClaimsAllowed: false, reason: 'Locale context is required.' };
  }

  const active = identity.status === 'active';
  const verified = identity.verification === 'verified';

  return {
    signInAllowed: true,
    ecosystemAccess: active,
    verifiedClaimsAllowed: active && verified,
    reason: active ? 'Identity is active.' : 'Identity is created but not yet active.'
  };
}

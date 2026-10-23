export type KoraJurisdictionStatus =
  | 'draft' | 'configured' | 'verified' | 'restricted' | 'inactive';

export interface KoraJurisdiction {
  jurisdictionId: string;
  countryCode: string;
  name: string;
  status: KoraJurisdictionStatus;
  languages: string[];
  currency: string;
  sourceRefs?: string[];
}

export interface JurisdictionDecision {
  available: boolean;
  localised: boolean;
  reason: string;
}

/**
 * A jurisdiction is available to production experiences only after its
 * configuration is verified and its local context is present.
 */
export function resolveJurisdictionPolicy(j: KoraJurisdiction): JurisdictionDecision {
  if (j.status === 'inactive' || j.status === 'restricted') {
    return { available: false, localised: false, reason: 'Jurisdiction is not available for the requested KORA experience.' };
  }

  if (j.status !== 'verified') {
    return { available: false, localised: false, reason: 'Jurisdiction configuration is not verified.' };
  }

  if (!j.languages.length || !j.currency) {
    return { available: false, localised: false, reason: 'Required local configuration is incomplete.' };
  }

  if (!j.sourceRefs?.length) {
    return { available: false, localised: false, reason: 'Jurisdiction sources have not been verified.' };
  }

  return { available: true, localised: true, reason: 'Verified jurisdiction context is available.' };
}

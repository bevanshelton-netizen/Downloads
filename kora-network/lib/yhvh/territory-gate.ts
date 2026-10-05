export type TerritoryStatus =
  | 'REVIEW_REQUIRED'
  | 'CLEAR'
  | 'RESTRICTED'
  | 'PARTNER_ONLY'
  | 'BLOCKED';

export type RightsRecord = {
  territory: string;
  contentId: string;
  distributionMethod: string;
  status: TerritoryStatus;
  rightsSource?: string;
  validFrom?: string;
  validUntil?: string;
  regulatoryReview?: 'pending' | 'cleared' | 'required';
};

export type GateDecision = {
  allowed: boolean;
  status: TerritoryStatus;
  reason: string;
  record?: RightsRecord;
};

/**
 * YHVH territory gate.
 * Fail closed: absence, expiry, restriction or unresolved regulatory review
 * cannot be treated as permission to distribute.
 */
export function evaluateTerritory(
  records: RightsRecord[],
  territory: string,
  contentId: string,
  distributionMethod: string,
  now = new Date()
): GateDecision {
  const record = records.find(
    (r) =>
      r.territory.toUpperCase() === territory.toUpperCase() &&
      r.contentId === contentId &&
      r.distributionMethod === distributionMethod
  );

  if (!record) {
    return {
      allowed: false,
      status: 'REVIEW_REQUIRED',
      reason: 'No verified territory/content/distribution rights record exists.'
    };
  }

  if (record.validUntil && new Date(record.validUntil) < now) {
    return {
      allowed: false,
      status: 'REVIEW_REQUIRED',
      reason: 'The verified rights record has expired.',
      record
    };
  }

  if (record.regulatoryReview === 'required' || record.regulatoryReview === 'pending') {
    return {
      allowed: false,
      status: 'REVIEW_REQUIRED',
      reason: 'Required regulatory review is not cleared.',
      record
    };
  }

  if (record.status !== 'CLEAR') {
    return {
      allowed: false,
      status: record.status,
      reason: `Distribution is not cleared: ${record.status}.`,
      record
    };
  }

  return {
    allowed: true,
    status: 'CLEAR',
    reason: 'Territory, content and distribution method are cleared.',
    record
  };
}

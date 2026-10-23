export type KoraWorkStatus =
  | 'draft' | 'open' | 'screening' | 'matched' | 'accepted'
  | 'in_progress' | 'completed' | 'cancelled' | 'closed';

export type KoraWorkVerification = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface KoraWorkRecord {
  workId: string;
  kind: 'job' | 'project' | 'gig' | 'assignment' | 'service';
  status: KoraWorkStatus;
  title: string;
  verification?: KoraWorkVerification;
  paymentRef?: string;
  updatedAt: string;
}

export interface WorkDecision {
  discoverable: boolean;
  matchable: boolean;
  actionable: boolean;
  reason: string;
}

/**
 * Work opportunities remain discoverable only when they are open or actively
 * progressing. Verification affects trust but must never be silently inferred.
 */
export function resolveWorkPolicy(record: KoraWorkRecord): WorkDecision {
  if (record.status === 'cancelled' || record.status === 'closed') {
    return { discoverable: false, matchable: false, actionable: false, reason: 'Work opportunity is closed.' };
  }

  if (record.status === 'draft') {
    return { discoverable: false, matchable: false, actionable: false, reason: 'Draft work is not public.' };
  }

  if (record.status === 'open' || record.status === 'screening' || record.status === 'matched') {
    return { discoverable: true, matchable: record.status !== 'matched', actionable: true, reason: 'Work is active.' };
  }

  if (record.status === 'accepted' || record.status === 'in_progress') {
    return { discoverable: false, matchable: false, actionable: true, reason: 'Work is engaged.' };
  }

  if (record.status === 'completed') {
    return { discoverable: false, matchable: false, actionable: false, reason: 'Work is completed.' };
  }

  return { discoverable: false, matchable: false, actionable: false, reason: 'Unknown work state.' };
}

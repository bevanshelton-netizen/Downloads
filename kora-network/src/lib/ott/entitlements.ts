export type KoraPlan = 'free' | 'premium' | 'sports' | 'family' | 'enterprise';
export type KoraEntitlement = 'live' | 'vod' | 'fast' | 'sports' | 'music' | 'kids' | 'faith' | 'creator';

export interface KoraSubscription {
  userId: string;
  plan: KoraPlan;
  active: boolean;
  startsAt: string;
  endsAt?: string;
}

export interface KoraEntitlementCheck {
  allowed: boolean;
  reason?: 'subscription_required' | 'subscription_expired' | 'content_not_in_plan';
}

const planEntitlements: Record<KoraPlan, KoraEntitlement[]> = {
  free: ['live', 'fast', 'music', 'kids', 'faith', 'creator'],
  premium: ['live', 'vod', 'fast', 'sports', 'music', 'kids', 'faith', 'creator'],
  sports: ['live', 'sports'],
  family: ['live', 'vod', 'fast', 'music', 'kids', 'faith', 'creator'],
  enterprise: ['live', 'vod', 'fast', 'sports', 'music', 'kids', 'faith', 'creator'],
};

export function checkEntitlement(subscription: KoraSubscription | undefined, contentType: KoraEntitlement, now = new Date()): KoraEntitlementCheck {
  if (!subscription || !subscription.active) return { allowed: false, reason: 'subscription_required' };
  if (subscription.endsAt && new Date(subscription.endsAt).getTime() <= now.getTime()) {
    return { allowed: false, reason: 'subscription_expired' };
  }
  if (!planEntitlements[subscription.plan].includes(contentType)) {
    return { allowed: false, reason: 'content_not_in_plan' };
  }
  return { allowed: true };
}

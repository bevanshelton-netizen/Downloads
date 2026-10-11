import type { KoraEntitlement } from './entitlements';

export type KoraProductionAccessMode = 'free' | 'ad_supported' | 'premium' | 'pay_per_view';

export interface KoraProductionRecord {
  id: string;
  title: string;
  accessMode: KoraProductionAccessMode;
  published: boolean;
}

export interface KoraEpisodeRecord {
  id: string;
  productionId: string;
  title: string;
  playbackId?: string | null;
  published: boolean;
}

export function entitlementForProduction(accessMode: KoraProductionAccessMode): KoraEntitlement {
  if (accessMode === 'premium' || accessMode === 'pay_per_view') return 'vod';
  return 'live';
}

export function productionRequiresAccount(accessMode: KoraProductionAccessMode): boolean {
  return accessMode === 'premium' || accessMode === 'pay_per_view';
}

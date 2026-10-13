export type KoraProductionAccessMode = 'free' | 'ad_supported' | 'premium' | 'pay_per_view';

export function entitlementForProduction(accessMode: KoraProductionAccessMode): 'vod' | 'live' | 'fast' | 'sports' | 'music' | 'kids' | 'faith' | 'creator' {
  switch (accessMode) {
    case 'free': return 'vod';
    case 'ad_supported': return 'vod';
    case 'premium': return 'vod';
    case 'pay_per_view': return 'vod';
  }
}

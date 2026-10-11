export type KoraAdType = 'pre-roll' | 'mid-roll' | 'post-roll' | 'banner' | 'sponsor';

export interface KoraAd {
  id: string;
  type: KoraAdType;
  mediaUrl?: string;
  clickUrl?: string;
  durationSeconds?: number;
  advertiserId: string;
  active: boolean;
}

export interface KoraAdRequest {
  placement: KoraAdType;
  contentId: string;
  userId?: string;
  country?: string;
}

export interface KoraAdEvent {
  adId: string;
  contentId: string;
  userId?: string;
  event: 'impression' | 'start' | '25%' | '50%' | '75%' | 'complete' | 'click' | 'skip';
  timestamp: string;
}

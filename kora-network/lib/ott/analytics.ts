export type KoraAnalyticsEventName =
  | 'app_open' | 'catalog_view' | 'content_view' | 'playback_start'
  | 'playback_pause' | 'playback_complete' | 'playback_error' | 'search'
  | 'subscription_start' | 'subscription_cancel' | 'ad_impression' | 'ad_complete';

export interface KoraAnalyticsEvent {
  name: KoraAnalyticsEventName;
  occurredAt: string;
  userId?: string;
  sessionId?: string;
  contentId?: string;
  device?: string;
  metadata?: Record<string, unknown>;
}

export function createAnalyticsEvent(name: KoraAnalyticsEventName, input: Omit<KoraAnalyticsEvent, 'name' | 'occurredAt'>): KoraAnalyticsEvent {
  return { name, occurredAt: new Date().toISOString(), ...input };
}

export type KoraAnalyticsEventName =
  | 'app_open'
  | 'catalog_view'
  | 'content_view'
  | 'playback_start'
  | 'playback_pause'
  | 'playback_complete'
  | 'playback_error'
  | 'search'
  | 'subscription_start'
  | 'subscription_cancel'
  | 'ad_impression'
  | 'ad_complete';

export interface KoraAnalyticsEvent {
  name: KoraAnalyticsEventName;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  contentId?: string;
  device?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function createAnalyticsEvent(
  name: KoraAnalyticsEventName,
  data: Omit<KoraAnalyticsEvent, 'name' | 'timestamp'> = {},
  now = new Date(),
): KoraAnalyticsEvent {
  return { name, timestamp: now.toISOString(), ...data };
}

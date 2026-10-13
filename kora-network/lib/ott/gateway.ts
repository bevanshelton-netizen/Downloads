import type { KoraDevice } from './devices';
import type { KoraEntitlement } from './entitlements';
import type { KoraPlaybackProtocol, KoraPlaybackSession } from './playback';
import type { starterCatalog } from './catalog';

interface Subscription {
  userId: string;
  plan: 'free' | 'premium' | 'sports' | 'family' | 'enterprise';
  active: boolean;
  startsAt: string;
  endsAt?: string;
}

interface PlaybackContext {
  catalog: typeof starterCatalog;
  subscription?: Subscription;
  content?: { id: string; active: boolean };
}

interface PlaybackRequest {
  contentId: string;
  device: KoraDevice;
  protocol: KoraPlaybackProtocol;
  userId?: string;
}

export function authorizePlayback(
  context: PlaybackContext,
  request: PlaybackRequest,
  entitlement: KoraEntitlement,
): { allowed: boolean; reason?: string; playbackSession?: KoraPlaybackSession } {
  if (context.content && !context.content.active) return { allowed: false, reason: 'content_inactive' };

  const publicEntitlements = new Set<KoraEntitlement>(['live', 'fast', 'kids', 'faith', 'music']);
  const subscriberEntitlements = new Set<KoraEntitlement>(['vod', 'sports', 'creator']);
  const entitled = publicEntitlements.has(entitlement) || (subscriberEntitlements.has(entitlement) && context.subscription?.active);

  if (!entitled) return { allowed: false, reason: 'subscription_required' };

  const streamUrl = context.catalog.channels.find((channel) => channel.active)?.streamUrl;
  const url = streamUrl || `/api/ott/play/${encodeURIComponent(request.contentId)}.${request.protocol}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  return {
    allowed: true,
    playbackSession: {
      sessionId: crypto.randomUUID(),
      protocol: request.protocol,
      url,
      expiresAt,
    },
  };
}

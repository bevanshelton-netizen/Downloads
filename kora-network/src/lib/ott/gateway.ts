import type { KoraCatalog } from './catalog';
import type { KoraAuthSession } from './identity';
import type { KoraPlaybackRequest, KoraPlaybackSession } from './playback';
import type { KoraEntitlement, KoraSubscription } from './entitlements';
import { checkEntitlement } from './entitlements';
import { createPlaybackSession } from './playback';

export interface KoraResolvedContent {
  id: string;
  active: boolean;
}

export interface KoraGatewayContext {
  catalog: KoraCatalog;
  session?: KoraAuthSession;
  subscription?: KoraSubscription;
  content?: KoraResolvedContent;
}

export interface KoraPlaybackDecision {
  allowed: boolean;
  reason?: 'unauthenticated' | 'content_not_found' | 'subscription_required' | 'subscription_expired' | 'content_not_in_plan';
  playbackSession?: KoraPlaybackSession;
}

export function authorizePlayback(
  context: KoraGatewayContext,
  request: KoraPlaybackRequest,
  contentType: KoraEntitlement,
  now = new Date(),
): KoraPlaybackDecision {
  const resolved = context.content?.id === request.contentId ? context.content : undefined;
  const channel = context.catalog.channels.find((item) => item.id === request.contentId);
  if ((!resolved || !resolved.active) && (!channel || !channel.active)) {
    return { allowed: false, reason: 'content_not_found' };
  }

  if (context.subscription) {
    const entitlement = checkEntitlement(context.subscription, contentType, now);
    if (!entitlement.allowed) return { allowed: false, reason: entitlement.reason };
  } else if (contentType !== 'live' && contentType !== 'fast' && contentType !== 'kids' && contentType !== 'faith' && contentType !== 'music' && contentType !== 'creator') {
    return { allowed: false, reason: 'subscription_required' };
  }

  return {
    allowed: true,
    playbackSession: createPlaybackSession({ ...request, userId: request.userId ?? context.session?.userId }, now),
  };
}

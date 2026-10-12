import { starterCatalog } from './catalog';
import { authorizePlayback } from './gateway';
import type { KoraEntitlement, KoraSubscription } from './entitlements';
import type { KoraPlaybackProtocol } from './playback';

export function createWatchPlaybackSession({ contentId, userId, device = 'web', protocol = 'hls', contentType = 'vod', subscription }: {
  contentId: string;
  userId?: string;
  device?: string;
  protocol?: KoraPlaybackProtocol;
  contentType?: KoraEntitlement;
  subscription?: KoraSubscription;
}) {
  return authorizePlayback(
    { catalog: starterCatalog, subscription },
    { contentId: 'kora-live', device, protocol, userId },
    contentType,
  );
}

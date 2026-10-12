import { starterCatalog } from './catalog';
import { authorizePlayback } from './gateway';
import type { KoraSubscription } from './entitlements';
import type { KoraPlaybackProtocol } from './playback';

export function createWatchPlaybackSession({
  contentId,
  userId,
  device = 'web',
  protocol = 'hls',
  subscription,
}: {
  contentId: string;
  userId?: string;
  device?: string;
  protocol?: KoraPlaybackProtocol;
  subscription?: KoraSubscription;
}) {
  return authorizePlayback(
    { catalog: starterCatalog, subscription },
    { contentId: 'kora-live', device, protocol, userId },
    'vod',
  );
}

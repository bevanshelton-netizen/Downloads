export type KoraPlaybackProtocol = 'hls' | 'dash';
export type KoraPlaybackState = 'idle' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export interface KoraPlaybackRequest {
  contentId: string;
  device: string;
  protocol: KoraPlaybackProtocol;
  userId?: string;
}

export interface KoraPlaybackSession {
  id: string;
  contentId: string;
  userId?: string;
  device: string;
  protocol: KoraPlaybackProtocol;
  state: KoraPlaybackState;
  startedAt: string;
  expiresAt: string;
}

export function createPlaybackSession(request: KoraPlaybackRequest, now = new Date()): KoraPlaybackSession {
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const seed = `${request.contentId}:${request.userId ?? 'guest'}:${startedAt}`;
  const id = `kp_${Array.from(seed).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 7).toString(36)}`;

  return {
    id,
    contentId: request.contentId,
    userId: request.userId,
    device: request.device,
    protocol: request.protocol,
    state: 'ready',
    startedAt,
    expiresAt,
  };
}

export function isPlaybackSessionValid(session: KoraPlaybackSession, now = new Date()): boolean {
  return new Date(session.expiresAt).getTime() > now.getTime() && session.state !== 'error';
}

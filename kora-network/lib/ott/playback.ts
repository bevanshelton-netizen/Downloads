export type KoraPlaybackProtocol = 'hls' | 'dash';

export interface KoraPlaybackSession {
  sessionId: string;
  protocol: KoraPlaybackProtocol;
  url: string;
  expiresAt: string;
}

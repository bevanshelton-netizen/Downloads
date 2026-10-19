import 'server-only';

export type BroadcastEngineState = 'planned' | 'configured' | 'verified';

export type BroadcastEngineChannel = {
  slug: string;
  streamUrl: string | null;
  state: BroadcastEngineState;
  source: 'owned' | 'external-fallback' | 'none';
  checkedAt: string;
  notes: string[];
};

const CHANNELS = [
  'kora-one',
  'kora-drama',
  'kora-family',
  'kora-faith',
  'kora-music',
  'kora-kids',
  'kora-creators',
] as const;

function streamKey(slug: string) {
  return `KORA_STREAM_URL_${slug.toUpperCase().replace(/-/g, '_')}`;
}

function ownedStream(slug: string) {
  return process.env[streamKey(slug)]?.trim() || null;
}

function verified(slug: string) {
  return process.env[`KORA_STREAM_${slug.toUpperCase().replace(/-/g, '_')}_VERIFIED`] === 'true';
}

export function getBroadcastEngineChannels(): BroadcastEngineChannel[] {
  const checkedAt = new Date().toISOString();
  return CHANNELS.map((slug) => {
    const streamUrl = ownedStream(slug);
    if (!streamUrl) {
      return {
        slug,
        streamUrl: null,
        state: 'planned',
        source: 'none',
        checkedAt,
        notes: ['No production HLS URL is configured.'],
      };
    }
    if (!verified(slug)) {
      return {
        slug,
        streamUrl,
        state: 'configured',
        source: 'owned',
        checkedAt,
        notes: ['HLS URL is configured but has not been independently verified.'],
      };
    }
    return {
      slug,
      streamUrl,
      state: 'verified',
      source: 'owned',
      checkedAt,
      notes: ['Stream is explicitly marked verified by the production runtime.'],
    };
  });
}

export function getBroadcastEngineSummary() {
  const channels = getBroadcastEngineChannels();
  return {
    engine: 'broadcast',
    state: channels.every((channel) => channel.state === 'verified')
      ? 'verified'
      : channels.some((channel) => channel.state !== 'planned')
        ? 'configured'
        : 'planned',
    channelCount: channels.length,
    verifiedChannels: channels.filter((channel) => channel.state === 'verified').length,
    configuredChannels: channels.filter((channel) => channel.state !== 'planned').length,
    channels,
  } as const;
}

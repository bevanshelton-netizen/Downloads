export interface KoraCatalogChannel {
  id: string;
  name: string;
  description: string;
  active: boolean;
  streamUrl?: string;
}

export interface KoraCatalogProgramme {
  id: string;
  title: string;
  description: string;
  channelId: string;
  startsAt: string;
  endsAt: string;
  entitlement: 'live' | 'vod' | 'fast' | 'sports' | 'music' | 'kids' | 'faith' | 'creator';
}

export const starterCatalog = {
  channels: [
    {
      id: 'kora-live',
      name: 'KORA Live',
      description: 'KORA Network live channel.',
      active: true,
      streamUrl: process.env.KORA_LIVE_STREAM_URL,
    },
  ] satisfies KoraCatalogChannel[],
  programmes: [] as KoraCatalogProgramme[],
};

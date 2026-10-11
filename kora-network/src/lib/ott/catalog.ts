export type KoraContentType = 'live' | 'vod' | 'fast' | 'sports' | 'music' | 'kids' | 'faith' | 'creator';

export interface KoraChannel {
  id: string;
  name: string;
  type: KoraContentType;
  streamUrl?: string;
  logo?: string;
  country?: string;
  language?: string;
  active: boolean;
}

export interface KoraProgramme {
  id: string;
  channelId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  thumbnail?: string;
}

export interface KoraCatalog {
  channels: KoraChannel[];
  programmes: KoraProgramme[];
}

export const starterCatalog: KoraCatalog = {
  channels: [
    { id: 'kora-live', name: 'KORA TV Live', type: 'live', active: true },
    { id: 'kora-music', name: 'KORA Music', type: 'music', active: true },
    { id: 'kora-kids', name: 'KORA Kids', type: 'kids', active: true },
    { id: 'kora-faith', name: 'KORA Faith', type: 'faith', active: true },
    { id: 'kora-sports', name: 'KORA Sports', type: 'sports', active: true },
  ],
  programmes: [],
};

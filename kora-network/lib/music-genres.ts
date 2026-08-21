export type MusicGenreGroup = {
  id: string;
  title: string;
  description: string;
  genres: readonly string[];
};

export const musicGenreGroups: readonly MusicGenreGroup[] = [
  {
    id: 'africa-now',
    title: 'Africa Now',
    description: 'The sounds moving clubs, charts, streets and festivals across the continent right now.',
    genres: [
      'Amapiano',
      'Afrobeats',
      'Afro-pop',
      'Afrofusion',
      'Afro-house',
      'Afrotech',
      'Gqom',
      'Kwaito',
      'Alté',
      'Bongo Flava',
      'Gengetone',
      'Highlife',
      'Hiplife',
      'Soukous',
      'Ndombolo',
      'Afro-soul',
      'Afro-jazz',
    ],
  },
  {
    id: 'roots-heritage',
    title: 'Roots & Heritage',
    description: 'Traditional and regional sounds with deep cultural identity, language and history.',
    genres: [
      'Traditional / Indigenous',
      'Folk',
      'Maskandi',
      'Mbaqanga',
      'Marabi',
      'Isicathamiya',
      'Mbube',
      'Cape Jazz',
      'Ghoema',
      'Riel Music',
      'Langarm',
      'Choral',
      'Bhangra',
      'World Music',
    ],
  },
  {
    id: 'faith-inspiration',
    title: 'Faith & Inspiration',
    description: 'Music for worship, reflection, celebration, testimony and community.',
    genres: [
      'Gospel',
      'Contemporary Gospel',
      'Praise & Worship',
      'Choir',
      'Christian Contemporary',
      'Sacred / Spiritual',
      'Traditional Spirituals',
      'Nasheed',
    ],
  },
  {
    id: 'global',
    title: 'Global Sounds',
    description: 'International genres with African artists, audiences and cross-cultural collaborations welcome.',
    genres: [
      'Hip-Hop / Rap',
      'R&B',
      'Soul',
      'Pop',
      'Jazz',
      'Blues',
      'Reggae',
      'Dancehall',
      'House',
      'Electronic / EDM',
      'Rock',
      'Alternative',
      'Indie',
      'Funk',
      'Disco',
      'Classical',
      'Orchestral',
      'Country',
      'Latin',
    ],
  },
] as const;

export const musicPerformanceFormats = [
  'Live concert',
  'Festival',
  'DJ set',
  'Acoustic / unplugged',
  'Choir concert',
  'Worship service',
  'Cypher / battle',
  'Studio session',
  'Music documentary',
  'Album listening premiere',
] as const;

export const allMusicGenres = Array.from(
  new Set(musicGenreGroups.flatMap((group) => [...group.genres])),
);

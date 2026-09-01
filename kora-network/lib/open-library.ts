export type OpenLibraryTrack = {
  id: string;
  title: string;
  creator: string;
  duration: string;
  license: 'CC0 1.0' | 'Public domain';
  sourcePage: string;
  mediaUrl: string;
  provenance: string;
};

function commonsMedia(filename: string) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`;
}

export const openLibraryTracks: readonly OpenLibraryTrack[] = [
  {
    id: 'grieg-morning-mood',
    title: 'Morning Mood',
    creator: 'Edvard Grieg · Musopen Symphony Orchestra',
    duration: '3:49',
    license: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Musopen_-_Morning.ogg',
    mediaUrl: commonsMedia('Musopen - Morning.ogg'),
    provenance: 'Wikimedia Commons records this performance as released into the public domain worldwide by Musopen.',
  },
  {
    id: 'bach-goldberg-aria',
    title: 'Goldberg Variations — Aria',
    creator: 'Johann Sebastian Bach · Shelley Katz',
    duration: '4:47',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Bach,_Goldberg_Variations,_Aria_(Musopen_version).ogg',
    mediaUrl: commonsMedia('Bach, Goldberg Variations, Aria (Musopen version).ogg'),
    provenance: 'Wikimedia Commons marks this recording CC0 1.0, permitting copying, modification, distribution and performance without permission.',
  },
  {
    id: 'beethoven-egmont',
    title: 'Egmont Overture, Op. 84',
    creator: 'Ludwig van Beethoven · Musopen Symphony Orchestra',
    duration: '9:01',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Beethoven_EgmontOvertureOp.84_LudwigVanBeethoven-EgmontOvertureOp.84.ogg',
    mediaUrl: commonsMedia('Beethoven EgmontOvertureOp.84 LudwigVanBeethoven-EgmontOvertureOp.84.ogg'),
    provenance: 'Wikimedia Commons marks this recording CC0 1.0, including related and neighbouring rights to the extent permitted by law.',
  },
  {
    id: 'borodin-steppes',
    title: 'In the Steppes of Central Asia',
    creator: 'Alexander Borodin · Musopen Symphony Orchestra',
    duration: '7:38',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Alexander_Borodin_-_In_The_Steppes_Of_Central_Asia.ogg',
    mediaUrl: commonsMedia('Alexander Borodin - In The Steppes Of Central Asia.ogg'),
    provenance: 'Wikimedia Commons marks this recording CC0 1.0, permitting commercial use without asking permission.',
  },
] as const;

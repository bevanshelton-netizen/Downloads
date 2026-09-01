export type OpenLibraryLicense = 'CC0 1.0' | 'Public domain';

export type OpenLibraryTrack = {
  id: string;
  title: string;
  creator: string;
  duration: string;
  genre: string;
  license: OpenLibraryLicense;
  sourcePage: string;
  mediaUrl: string;
  provenance: string;
};

export type OpenLibraryVideo = {
  id: string;
  title: string;
  creator: string;
  duration: string;
  category: 'Africa & Culture' | 'Science & Nature' | 'Learning';
  license: 'CC0 1.0';
  description: string;
  sourcePage: string;
  mediaUrl: string;
  provenance: string;
};

function commonsMedia(filename: string) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`;
}

export const openLibraryTracks: readonly OpenLibraryTrack[] = [
  {
    id: 'us-army-main-stem',
    title: 'Main Stem',
    creator: 'U.S. Army Blues',
    duration: '2:50',
    genre: 'Jazz / Big Band',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:US_Army_Blues_-_02_-_Main_Stem.ogg',
    mediaUrl: commonsMedia('US Army Blues - 02 - Main Stem.ogg'),
    provenance: 'Wikimedia Commons records this U.S. Army Blues performance as CC0 and shows a 2026 license review confirming the stated license at its source.',
  },
  {
    id: 'jazz-at-the-park',
    title: 'Jazz at the Park',
    creator: 'Manwithmetalpig',
    duration: '3:26',
    genre: 'Jazz',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Jazz_at_the_park.ogg',
    mediaUrl: commonsMedia('Jazz at the park.ogg'),
    provenance: 'The creator uploaded this flute-and-tenor-sax jazz performance as their own work under the worldwide CC0 public-domain dedication.',
  },
  {
    id: 'c-blues-major-third',
    title: 'C Blues with Major Third',
    creator: 'Michael Lenz',
    duration: '0:21',
    genre: 'Blues',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:C-Blues-gro%C3%9FeTerz.ogg',
    mediaUrl: commonsMedia('C-Blues-großeTerz.ogg'),
    provenance: 'The creator published this blues-scale recording as own work under CC0, permitting copying, modification, distribution and commercial use without permission.',
  },
  {
    id: 'cloud-rap-beat',
    title: 'Cloud Rap Beat',
    creator: 'Zanahary',
    duration: '0:12',
    genre: 'Hip-Hop / Cloud Rap',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Cloud_rap_beat.ogg',
    mediaUrl: commonsMedia('Cloud rap beat.ogg'),
    provenance: 'The creator published this original cloud-rap instrumental under CC0 1.0, dedicating the recording to the public domain.',
  },
  {
    id: 'funk-carioca-loop',
    title: 'Funk Carioca — 8 Bar Loop',
    creator: 'Zanahary / Mangroves',
    duration: '0:04',
    genre: 'Baile Funk',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Funk_carioca_8_bar_loop.ogg',
    mediaUrl: commonsMedia('Funk carioca 8 bar loop.ogg'),
    provenance: 'Wikimedia Commons records this self-published funk carioca loop as CC0 1.0, including commercial reuse without permission.',
  },
  {
    id: 'kaotik-reggae',
    title: 'Kaotik Ice Cream Truck Reggae',
    creator: 'Frederic Lardon',
    duration: '2:12',
    genre: 'Reggae / Experimental',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Frederic_Lardon_-_14_-_Kaotik_ice_cream_truck_reggae.ogg',
    mediaUrl: commonsMedia('Frederic Lardon - 14 - Kaotik ice cream truck reggae.ogg'),
    provenance: 'Wikimedia Commons publishes this Frederic Lardon recording under the CC0 1.0 Universal Public Domain Dedication.',
  },
  {
    id: 'loyalty-you-know-why',
    title: 'You Know Why',
    creator: 'Loyalty Freak Music',
    duration: '4:28',
    genre: 'Electronic / Jazz / Alt Hip-Hop',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_04_-_You_know_why.ogg',
    mediaUrl: commonsMedia('Loyalty Freak Music - 04 - You know why.ogg'),
    provenance: 'Wikimedia Commons identifies this recording as CC0 and categorises it across electronic, jazz and alternative hip-hop music.',
  },
  {
    id: 'grieg-morning-mood',
    title: 'Morning Mood',
    creator: 'Edvard Grieg · Musopen Symphony Orchestra',
    duration: '3:49',
    genre: 'Classical',
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
    genre: 'Classical',
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
    genre: 'Classical',
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
    genre: 'Classical',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Alexander_Borodin_-_In_The_Steppes_Of_Central_Asia.ogg',
    mediaUrl: commonsMedia('Alexander Borodin - In The Steppes Of Central Asia.ogg'),
    provenance: 'Wikimedia Commons marks this recording CC0 1.0, permitting commercial use without asking permission.',
  },
  {
    id: 'strauss-kaiserwalzer',
    title: 'Kaiser-Walzer',
    creator: 'Johann Strauss II · Musopen recording',
    duration: '3:01',
    genre: 'Classical',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Strauss,_Kaiserwalzer.ogg',
    mediaUrl: commonsMedia('Strauss, Kaiserwalzer.ogg'),
    provenance: 'Wikimedia Commons identifies the recording as copyrighted material dedicated to the public domain under CC0.',
  },
  {
    id: 'beethoven-pathetique-adagio',
    title: 'Pathétique Sonata — Adagio cantabile',
    creator: 'Ludwig van Beethoven · Paul Pitman',
    duration: '4:58',
    genre: 'Classical',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Beethoven,_Sonata_No._8_in_C_Minor_Pathetique,_Op._13_-_II._Adagio_cantabile.ogg',
    mediaUrl: commonsMedia('Beethoven, Sonata No. 8 in C Minor Pathetique, Op. 13 - II. Adagio cantabile.ogg'),
    provenance: 'Wikimedia Commons structured rights data marks this recording as dedicated to the public domain under CC0.',
  },
  {
    id: 'strauss-wiener-blut',
    title: 'Wiener Blut, Op. 354',
    creator: 'Johann Strauss II · Musopen recording',
    duration: '2:58',
    genre: 'Classical',
    license: 'CC0 1.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Johann_Strauss_-_Wiener_Blut_Op._354.ogg',
    mediaUrl: commonsMedia('Johann Strauss - Wiener Blut Op. 354.ogg'),
    provenance: 'Wikimedia Commons marks the recording CC0 and dedicated to the public domain by the copyright holder.',
  },
] as const;

export const openLibraryVideos: readonly OpenLibraryVideo[] = [
  {
    id: 'hargeisa-street-scenes',
    title: 'Street Scenes in Hargeisa',
    creator: 'Bdell555 / Wikimedia Commons',
    duration: '0:51',
    category: 'Africa & Culture',
    license: 'CC0 1.0',
    description: 'A short visual visit through street scenes in Hargeisa, Somaliland.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Hargeisa.ogv',
    mediaUrl: commonsMedia('Hargeisa.ogv'),
    provenance: 'The copyright holder released this video under the worldwide CC0 public-domain dedication.',
  },
  {
    id: 'bati-ethiopia',
    title: 'Everyday Life in Bati, Ethiopia',
    creator: 'Brian Dell',
    duration: 'Short film',
    category: 'Africa & Culture',
    license: 'CC0 1.0',
    description: 'Street-life scenes near the bus station in Bati, Ethiopia.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Bati.ogv',
    mediaUrl: commonsMedia('Bati.ogv'),
    provenance: 'The creator published this work under CC0, waiving copyright and related rights to the extent allowed by law.',
  },
  {
    id: 'palm-tree-climbing',
    title: 'Climbing a Palm Tree',
    creator: 'Wiki Loves Africa 2026 contributor',
    duration: '0:44',
    category: 'Africa & Culture',
    license: 'CC0 1.0',
    description: 'A 2026 Wiki Loves Africa clip documenting a man climbing a palm tree in an Igbo community.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:A_Video_of_a_Man_Climbing_a_Palm_tree.webm',
    mediaUrl: commonsMedia('A Video of a Man Climbing a Palm tree.webm'),
    provenance: 'Wikimedia Commons structured rights data identifies the work as dedicated to the public domain under CC0.',
  },
  {
    id: 'transverse-wave-motion',
    title: 'Transverse Wave Motion',
    creator: 'Drshaunakdas',
    duration: 'Science demo',
    category: 'Science & Nature',
    license: 'CC0 1.0',
    description: 'A visual demonstration of transverse wave motion inside Science City.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Transverse_Wave_Motion_inside_Science_City.webm',
    mediaUrl: commonsMedia('Transverse Wave Motion inside Science City.webm'),
    provenance: 'The creator released the video under the CC0 1.0 Universal Public Domain Dedication.',
  },
  {
    id: 'lightning-simulation',
    title: 'Simple Lightning Simulation',
    creator: 'NectarLupine',
    duration: '0:12',
    category: 'Science & Nature',
    license: 'CC0 1.0',
    description: 'A compact visual simulation of lightning behaviour.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:SimpleLightningSimulation.webm',
    mediaUrl: commonsMedia('SimpleLightningSimulation.webm'),
    provenance: 'The uploader released the simulation under CC0, allowing copying, modification, distribution and commercial use without permission.',
  },
  {
    id: 'perseids',
    title: 'Perseids Meteor Shower',
    creator: 'Bautsch',
    duration: '0:07',
    category: 'Science & Nature',
    license: 'CC0 1.0',
    description: 'A short night-sky view of the Perseids meteor shower.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Perseids.202-08-12.1.00x.webm',
    mediaUrl: commonsMedia('Perseids.202-08-12.1.00x.webm'),
    provenance: 'Wikimedia Commons records the uploader as releasing the clip under the CC0 public-domain dedication.',
  },
  {
    id: 'identifying-public-domain',
    title: 'Identifying Works in the Public Domain',
    creator: 'Timmylegend',
    duration: '1:41',
    category: 'Learning',
    license: 'CC0 1.0',
    description: 'A short educational video explaining how to identify works in the public domain.',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Identifying_works_in_the_Public_Domain.webm',
    mediaUrl: commonsMedia('Identifying works in the Public Domain.webm'),
    provenance: 'The creator released the educational video under CC0 1.0 Universal.',
  },
] as const;

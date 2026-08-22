import type { Metadata } from 'next';
import Link from 'next/link';
import { musicGenreGroups, musicPerformanceFormats } from '@/lib/music-genres';
import styles from './music.module.css';

export const metadata: Metadata = {
  title: 'Music',
  description: 'Discover African and global music genres on KORA, from Amapiano and Gospel to Jazz, Hip-Hop, Reggae, Rock and Classical.',
};

const regions = [
  ['Southern Africa', 'Amapiano • Gqom • Kwaito • Maskandi • Mbaqanga • Gospel • Jazz'],
  ['West Africa', 'Afrobeats • Highlife • Hiplife • Afrofusion • Gospel • Hip-Hop'],
  ['East Africa', 'Bongo Flava • Gengetone • Afro-pop • Gospel • Traditional'],
  ['Central Africa', 'Soukous • Ndombolo • Rumba • Traditional • Afro-pop'],
  ['North Africa', 'Raï • Chaabi • Amazigh • Arabic Pop • Hip-Hop • Electronic'],
  ['Africa + Diaspora', 'Reggae • Dancehall • R&B • Soul • Jazz • House • Global collaborations'],
] as const;

export default function MusicPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>KORA MUSIC • EVERY RHYTHM HAS A HOME</div>
          <h1>One African stage.<br/><span>Many sounds.</span></h1>
          <p>KORA is built for the full spectrum of music: new African movements, heritage sounds, faith music and global genres. Artists do not have to fit into one box to belong here.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/open-africa">Watch music free →</Link>
            <Link className={styles.secondary} href="/artists">Discover KORA artists</Link>
            <Link className={styles.secondary} href="/perform-live">Perform live on KORA</Link>
            <Link className={styles.secondary} href="/creators">Join as an artist</Link>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <span>♪</span><b>♫</b><strong>♬</strong><i>●</i><em>KORA</em>
        </div>
      </section>

      <div className={styles.rail}>
        <span>AMAPIANO</span><i>◆</i><span>GOSPEL</span><i>◆</i><span>JAZZ</span><i>◆</i><span>HIP-HOP</span><i>◆</i><span>MASKANDI</span><i>◆</i><span>REGGAE</span><i>◆</i><span>CLASSICAL</span>
      </div>

      <section className={styles.intro} id="genre-discovery">
        <div className={styles.eyebrow}>BROWSE BY GENRE</div>
        <h2>From the village to the festival stage. From church choirs to global clubs.</h2>
        <p>Choose a genre to discover matching KORA artists and their upcoming live events. Hybrid and emerging genres are welcome too—Creator Studio still allows artists to describe a sound in their own words.</p>
      </section>

      <section className={styles.genreGrid}>
        {musicGenreGroups.map((group, index) => (
          <article className={styles.genreGroup} data-tone={index % 4} id={group.id} key={group.id}>
            <div className={styles.groupHead}>
              <span>0{index + 1}</span>
              <div><h2>{group.title}</h2><p>{group.description}</p></div>
            </div>
            <div className={styles.chips}>
              {group.genres.map((genre) => (
                <Link href={`/artists?genre=${encodeURIComponent(genre)}`} key={genre} aria-label={`Discover ${genre} artists on KORA`}>
                  {genre}<b aria-hidden="true"> →</b>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.regions}>
        <header><div className={styles.eyebrow}>DISCOVER THE CONTINENT</div><h2>Regional identity without regional limits.</h2><p>KORA can surface music by genre, country, language, region and live event—then carry it to audiences anywhere in the world.</p></header>
        <div className={styles.regionGrid}>
          {regions.map(([name, sounds]) => <article key={name}><h3>{name}</h3><p>{sounds}</p></article>)}
        </div>
      </section>

      <section className={styles.formats}>
        <div>
          <div className={styles.eyebrow}>MORE THAN TRACKS</div>
          <h2>Music becomes television on KORA.</h2>
          <p>We are building music around performances, stories and fan moments—not only audio playback.</p>
          <Link className={styles.primary} href="/perform-live">Take your show live →</Link>
        </div>
        <div className={styles.formatList}>
          {musicPerformanceFormats.map((format) => <span key={format}>{format}</span>)}
        </div>
      </section>

      <section className={styles.artistCall}>
        <div>
          <div className={styles.eyebrow}>ARTISTS, CHOIRS, BANDS, DJs & LABELS</div>
          <h2>If you make music, KORA should have a lane for you.</h2>
          <p>Amapiano producer? Gospel choir? Jazz quartet? Maskandi artist? Rock band? Classical ensemble? DJ? Independent singer-songwriter? Bring the music and the audience you want to build.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/artists">Explore artist pages →</Link>
          <Link className={styles.secondary} href="/creators">Join the creator network</Link>
          <Link className={styles.secondary} href="/perform-live">Founding live artists</Link>
        </div>
      </section>
    </main>
  );
}

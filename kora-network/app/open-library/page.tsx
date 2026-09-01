import type { Metadata } from 'next';
import Link from 'next/link';
import { openLibraryTracks, openLibraryVideos } from '@/lib/open-library';
import styles from './open-library.module.css';

export const metadata: Metadata = {
  title: 'Open Library',
  description: 'Watch and listen free on KORA from a catalogue of verified CC0 and public-domain media with a retained rights trail.',
};

const categories = ['Africa & Culture', 'Science & Nature', 'Learning'] as const;

export default function OpenLibraryPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>KORA OPEN LIBRARY • WATCH FREE</div>
          <h1>Real content.<br/><span>No royalty baggage.</span></h1>
          <p>Explore KORA&apos;s growing free library of music, African culture, science, nature and learning media. Every launch item carries a visible source record showing why KORA is allowed to use it.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#watch">Start watching →</a>
            <Link className={styles.secondary} href="/music#open-library">Open free music</Link>
          </div>
        </div>
        <div className={styles.heroPanel}>
          <strong>{openLibraryVideos.length + openLibraryTracks.length}</strong>
          <span>verified launch items</span>
          <div className={styles.miniStats}>
            <div><b>{openLibraryVideos.length}</b><small>video clips</small></div>
            <div><b>{openLibraryTracks.length}</b><small>music tracks</small></div>
            <div><b>CC0 / PD</b><small>rights standard</small></div>
          </div>
        </div>
      </section>

      <section className={styles.ruleStrip}>
        <strong>KORA OPEN-LIBRARY RULE</strong>
        <span>CC0 or verified public-domain rights trail first. No vague “royalty-free” claims.</span>
      </section>

      <section className={styles.watch} id="watch">
        <header className={styles.sectionHead}>
          <div>
            <div className={styles.eyebrow}>WATCH FREE</div>
            <h2>Africa, science, nature and learning.</h2>
          </div>
          <p>These videos stream from their verified Wikimedia Commons media records. KORA does not claim ownership of the underlying works.</p>
        </header>

        {categories.map((category) => {
          const items = openLibraryVideos.filter((item) => item.category === category);
          return (
            <section className={styles.category} key={category}>
              <div className={styles.categoryTitle}><h3>{category}</h3><span>{items.length} free</span></div>
              <div className={styles.videoGrid}>
                {items.map((item) => (
                  <article className={styles.card} key={item.id}>
                    <div className={styles.videoWrap}>
                      <video controls preload="metadata" src={item.mediaUrl}>Your browser does not support video playback.</video>
                      <span className={styles.freeBadge}>FREE • {item.license}</span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}><span>{item.duration}</span><span>{item.category}</span></div>
                      <h4>{item.title}</h4>
                      <p className={styles.creator}>{item.creator}</p>
                      <p>{item.description}</p>
                      <p className={styles.provenance}>{item.provenance}</p>
                      <a href={item.sourcePage} target="_blank" rel="noreferrer">View rights source ↗</a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </section>

      <section className={styles.musicShelf}>
        <header className={styles.sectionHead}>
          <div>
            <div className={styles.eyebrow}>LISTEN FREE</div>
            <h2>The KORA public-domain music shelf.</h2>
          </div>
          <Link className={styles.primary} href="/music#open-library">See full Music page →</Link>
        </header>
        <div className={styles.trackGrid}>
          {openLibraryTracks.slice(0, 6).map((track) => (
            <article className={styles.track} key={track.id}>
              <div><span className={styles.audioBadge}>FREE • {track.license}</span><small>{track.duration}</small></div>
              <h3>{track.title}</h3>
              <p>{track.creator}</p>
              <audio controls preload="none" src={track.mediaUrl}>Your browser does not support audio playback.</audio>
              <a href={track.sourcePage} target="_blank" rel="noreferrer">Rights record ↗</a>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.guardrail}>
        <div>
          <div className={styles.eyebrow}>RIGHTS-FIRST CATALOGUE</div>
          <h2>Free to watch should not mean legally careless.</h2>
        </div>
        <p>KORA retains the source page and stated licence with every Open Library item. If a rights record changes, becomes disputed or cannot be independently re-verified, the item can be removed from the catalogue.</p>
      </section>
    </main>
  );
}

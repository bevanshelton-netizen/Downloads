import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';
import styles from './coming-soon.module.css';

const categories = [
  { icon: '🎬', label: 'Drama & Film' },
  { icon: '🪘', label: 'Music & Rhythm' },
  { icon: '🎙️', label: 'Comedy & Talk' },
  { icon: '⚽', label: 'Sport & Culture' },
  { icon: '👨🏾‍👩🏾‍👧🏾', label: 'Faith & Family' },
  { icon: '💃🏾', label: 'Dance & Lifestyle' },
];

const entertainmentSymbols = [
  { symbol: '🎵', label: 'Music', tone: 'music' },
  { symbol: '🎞️', label: 'Movies', tone: 'movies' },
  { symbol: '🦁', label: 'Cartoons', tone: 'cartoons' },
  { symbol: '📺', label: 'Live TV', tone: 'live' },
  { symbol: '💃🏾', label: 'Dance', tone: 'dance' },
  { symbol: '⚽', label: 'Sport', tone: 'sport' },
  { symbol: '👨🏾‍👩🏾‍👧🏾', label: 'Family', tone: 'family' },
];

const cultureMoments = [
  { symbol: '🪘', title: 'The beat', copy: 'Amapiano, Afrobeats, gospel, jazz and sounds still being invented.' },
  { symbol: '🎭', title: 'The story', copy: 'Drama, comedy and cinema shaped by the places we call home.' },
  { symbol: '🎙️', title: 'The voice', copy: 'Bold creators, honest conversations and ideas crossing every border.' },
  { symbol: '⚽', title: 'The spirit', copy: 'Sport, celebration and the electric joy of watching together.' },
];

export default async function ComingSoon({ searchParams }: { searchParams: Promise<{ maintenance?: string }> }) {
  const [{ maintenance }, release] = await Promise.all([searchParams, getPlatformReleaseState()]);
  const isMaintenance = maintenance === '1' || release.maintenance_mode;

  return (
    <main className={styles.page} id="main-content">
      <section className={styles.hero}>
        <div className={styles.venueLights} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.venueSymbols} aria-hidden="true">
          <span className={styles.noteOne}>♪</span>
          <span className={styles.noteTwo}>♫</span>
          <span className={styles.reel}>🎞️</span>
          <span className={styles.clapper}>🎬</span>
          <span className={styles.star}>✦</span>
        </div>
        <div className={styles.copy}>
          <div className={styles.kicker}><span className={styles.pulse} /> AFRICA&apos;S NEXT SCREEN IS WAKING UP</div>
          <h1 className={styles.title}>Feel the rhythm.<span>Meet KORA.</span></h1>
          <p className={styles.lead}>
            {isMaintenance
              ? (release.maintenance_message || 'We are tuning the network for a brighter, faster and safer KORA experience.')
              : 'A bold new home for African drama, music, comedy, faith, sport, family entertainment and creator-led television—made for every generation.'}
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/login">Join the controlled launch →</Link>
            <Link className={styles.secondary} href="/creators">I&apos;m a creator</Link>
            <Link className={styles.secondary} href="/advertise">I&apos;m a brand</Link>
          </div>
          <div className={styles.trust}>
            <span>Family-safe</span><span>Creator-first</span><span>Live + On Demand</span><span>Made in Africa</span>
          </div>
        </div>

        <div className={styles.stage} aria-label="KORA entertainment highlights">
          <div className={styles.glow} />
          <div className={styles.venueSign} aria-hidden="true"><span>●</span> KORA LIVE TONIGHT <span>●</span></div>
          <div className={styles.cards}>
            <article className={[styles.card, styles.cardOne].join(' ')}>
              <small>KORA ORIGINALS</small><span className={styles.icon}>🎭</span><strong>Stories that feel like home.</strong>
            </article>
            <article className={[styles.card, styles.cardTwo].join(' ')}>
              <small>LIVE & LOUD</small><span className={styles.icon}>🎤</span><strong>Africa&apos;s sound. One stage.</strong>
            </article>
            <article className={[styles.card, styles.cardThree].join(' ')}>
              <small>FOR EVERY GENERATION</small><span className={styles.icon}>🌍</span><strong>Watch together. Feel connected.</strong>
            </article>
          </div>
          <div className={styles.cartoonCast} aria-label="KORA's family-friendly entertainment characters" role="img">
            <span className={styles.cartoonOne}>👩🏾‍🎤</span>
            <span className={styles.cartoonTwo}>🧑🏿‍🎤</span>
            <span className={styles.cartoonThree}>🦁</span>
            <b>Meet the KORA crew!</b>
          </div>
        </div>
      </section>

      <section className={styles.platformStory}>
        <div className={styles.africaSignature} aria-label="Built in Africa, for Africa, ready for the world">
          <span>BUILT IN AFRICA</span><i>◆</i><span>FOR AFRICA</span><i>◆</i><span>READY FOR THE WORLD</span>
        </div>
        <div className={styles.platformPitch}>
          <div className={styles.platformCopy}>
            <div className={styles.goldEyebrow}>AFRICA&apos;S FAMILY-SAFE ENTERTAINMENT NETWORK</div>
            <h2>One platform. Africa&apos;s stories, sounds and stars.</h2>
            <p>KORA brings African live television, movies, short drama, music, cartoons, comedy, faith, sport and creator channels together—available live and on demand for audiences at home and across the world.</p>
          </div>
          <div className={styles.platformActions}>
            <article><span>▶</span><div><b>WATCH</b><p>Stream live channels and on-demand entertainment for every generation.</p></div></article>
            <article><span>●</span><div><b>CREATE</b><p>Launch your channel, own your work and grow a loyal audience.</p></div></article>
            <article><span>✦</span><div><b>ADVERTISE</b><p>Place your brand inside trusted African culture—not beside random clicks.</p></div></article>
          </div>
        </div>
        <div className={styles.platformLinks}>
          <Link href="/login">Start watching →</Link>
          <Link href="/creators">Bring your content →</Link>
          <Link href="/advertise">Reach KORA audiences →</Link>
        </div>
      </section>

      <section className={styles.symbolShowcase} aria-label="Entertainment on KORA">
        <div className={styles.symbolShowcaseHead}>
          <span>THIS IS KORA</span>
          <strong>See it. Hear it. Feel it.</strong>
        </div>
        <div className={styles.symbolGrid}>
          {entertainmentSymbols.map((item) => (
            <article className={[styles.symbolTile, styles[item.tone]].join(' ')} key={item.label}>
              <span aria-hidden="true">{item.symbol}</span>
              <b>{item.label}</b>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.patternBand} aria-hidden="true">
        <span>◆</span><span>▲</span><span>●</span><span>◇</span><span>✦</span><span>▰</span><span>◆</span><span>▲</span><span>●</span><span>◇</span><span>✦</span><span>▰</span>
      </div>

      <div className={styles.ribbon} aria-hidden="true">
        <div className={styles.ribbonTrack}>
          <span>LIVE TV</span><span>SHORT DRAMA</span><span>MUSIC</span><span>COMEDY</span><span>FAITH</span><span>KIDS</span><span>CREATOR TV</span>
          <span>LIVE TV</span><span>SHORT DRAMA</span><span>MUSIC</span><span>COMEDY</span><span>FAITH</span><span>KIDS</span><span>CREATOR TV</span>
        </div>
      </div>

      <section className={styles.culture}>
        <div className={styles.cultureIntro}>
          <div className={styles.eyebrow}>THE CONTINENT IN FULL COLOUR</div>
          <h2>54 countries. Countless rhythms. One brilliant screen.</h2>
          <p>Contemporary African entertainment without borders—rooted in home, alive to the world, and designed for everyone to enjoy.</p>
        </div>
        <div className={styles.cultureGrid}>
          {cultureMoments.map((moment) => (
            <article className={styles.cultureCard} key={moment.title}>
              <span className={styles.cultureSymbol}>{moment.symbol}</span>
              <div><strong>{moment.title}</strong><p>{moment.copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <div className={styles.eyebrow}>SOMETHING FOR EVERY MOOD</div>
          <h2>Whatever your vibe, it lives on KORA.</h2>
          <p>Fresh energy for younger audiences, familiar warmth for families, and meaningful African storytelling for viewers of every age.</p>
        </header>
        <div className={styles.categories}>
          {categories.map((category) => (
            <article className={styles.category} key={category.label}>
              <span>{category.icon}</span><strong>{category.label}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.audiences}>
        <article className={styles.audience}>
          <div className={styles.eyebrow}>FOR VIEWERS</div>
          <b>Entertainment that belongs to us.</b>
          <p>Watch African stories, live channels and unforgettable moments in a safe, welcoming space.</p>
          <Link href="/login">Invited member access →</Link>
        </article>
        <article className={styles.audience}>
          <div className={styles.eyebrow}>FOR CREATORS</div>
          <b>Your story. Your audience. Your IP.</b>
          <p>Build a channel, grow a community and participate transparently in the value you create.</p>
          <Link href="/creators">Explore creator opportunities →</Link>
        </article>
        <article className={styles.audience}>
          <div className={styles.eyebrow}>FOR BRANDS</div>
          <b>Reach culture, not just clicks.</b>
          <p>Support programmes and creators audiences care about through measurable, family-safe campaigns.</p>
          <Link href="/advertise">Explore brand partnerships →</Link>
        </article>
      </section>

      <section className={styles.finalCta}>
        <h2>Africa is not waiting for the future. We&apos;re streaming it.</h2>
        <p>KORA is currently welcoming invited members while final production integrations and external operating approvals are completed.</p>
        <Link className={styles.darkButton} href="/login">Invited member sign in</Link>
      </section>
    </main>
  );
}

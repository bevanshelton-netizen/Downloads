import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';
import styles from './coming-soon.module.css';

const categories = [
  { icon: '🎬', label: 'Drama & Film' },
  { icon: '🎵', label: 'Music' },
  { icon: '😂', label: 'Comedy' },
  { icon: '⚽', label: 'Sport & Culture' },
  { icon: '✨', label: 'Faith & Family' },
  { icon: '🌍', label: 'African Stories' },
];

export default async function ComingSoon({ searchParams }: { searchParams: Promise<{ maintenance?: string }> }) {
  const [{ maintenance }, release] = await Promise.all([searchParams, getPlatformReleaseState()]);
  const isMaintenance = maintenance === '1' || release.maintenance_mode;

  return (
    <main className={styles.page} id="main-content">
      <section className={styles.hero}>
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
        </div>
      </section>

      <div className={styles.ribbon} aria-hidden="true">
        <div className={styles.ribbonTrack}>
          <span>LIVE TV</span><span>SHORT DRAMA</span><span>MUSIC</span><span>COMEDY</span><span>FAITH</span><span>KIDS</span><span>CREATOR TV</span>
          <span>LIVE TV</span><span>SHORT DRAMA</span><span>MUSIC</span><span>COMEDY</span><span>FAITH</span><span>KIDS</span><span>CREATOR TV</span>
        </div>
      </div>

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

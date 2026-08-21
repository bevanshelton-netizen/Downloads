import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';
import styles from './perform-live.module.css';

const journey = [
  ['01', 'Apply', 'Tell us about your act, audience, music and the concert you want to stage.'],
  ['02', 'Verify', 'KORA checks identity, performance rights, venue permissions and family-safe suitability.'],
  ['03', 'Rehearse', 'We test your camera, sound, connection, graphics and private broadcast feed.'],
  ['04', 'Go live', 'KORA promotes the event, streams it to fans and prepares the replay and results.'],
] as const;

export default async function PerformLive() {
  const release = await getPlatformReleaseState();
  const applicationsOpen = release.creator_applications_enabled;
  const applyHref = applicationsOpen ? '/creators/apply' : '/login?next=/creators/apply';

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>KORA FOUNDING ARTISTS • CONTROLLED PILOT</div>
          <h1>Your stage.<br/><span>Africa&apos;s screen.</span><br/>The world watching.</h1>
          <p>Stream concerts, festivals, gospel, jazz, amapiano, comedy, spoken word and cultural performances live on KORA—then keep the recording working for you.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={applyHref}>{applicationsOpen ? 'Apply to perform live →' : 'Join the founding artist waitlist →'}</Link>
            <a className={styles.secondary} href="#how-it-works">See how it works</a>
          </div>
          <small>Recruitment is open for controlled pilots. Public broadcasting begins only after rights, safety, payment and technical rehearsal checks pass.</small>
        </div>
        <div className={styles.stage} aria-hidden="true">
          <div className={styles.lights}><i/><i/><i/><i/></div>
          <div className={styles.screen}><b>LIVE</b><span>♪ KORA ♪</span><strong>AFRICA ON STAGE</strong></div>
          <div className={styles.crowd}>● ● ● ● ● ● ● ● ● ● ● ● ● ● ●</div>
        </div>
      </section>

      <div className={styles.rail}><span>LIVE CONCERTS</span><i>◆</i><span>GLOBAL DISCOVERY</span><i>◆</i><span>TICKETS + SPONSORS + REPLAYS</span></div>

      <section className={styles.value}>
        <div><span>90%</span><strong>of net ticket revenue to the founding artist</strong><small>Under the accepted event deal; payment costs and refunds are deducted before the split.</small></div>
        <div><span>1</span><strong>artist page built for discovery</strong><small>Concert, biography, booking, merchandise and social links in one destination.</small></div>
        <div><span>∞</span><strong>value after the final song</strong><small>Approved recordings can continue earning through replay, sponsors and advertising.</small></div>
      </section>

      <section className={styles.how} id="how-it-works">
        <header><div className={styles.eyebrow}>FROM APPLICATION TO APPLAUSE</div><h2>A professional route onto the KORA stage.</h2></header>
        <div className={styles.steps}>{journey.map(([number,title,copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className={styles.revenue}>
        <div>
          <div className={styles.eyebrow}>MORE THAN A LIVESTREAM</div>
          <h2>Turn every performance into a marketing campaign.</h2>
          <p>KORA brings the concert, trailer, artist story, sponsor placement, booking links, merchandise and replay together. The artist receives audience evidence that can help win promoters, venues, festivals and brand partners.</p>
        </div>
        <ul>
          <li><b>Free sponsored broadcasts</b><span>Reach first; brands help fund the stage.</span></li>
          <li><b>Ticketed premieres</b><span>Sell access to special concerts and launches.</span></li>
          <li><b>Replay earnings</b><span>Keep approved performances discoverable after the event.</span></li>
          <li><b>Fan conversion</b><span>Drive bookings, merchandise and social followers.</span></li>
        </ul>
      </section>

      <section className={styles.fit}>
        <div className={styles.eyebrow}>WHO SHOULD APPLY</div>
        <h2>African talent in every rhythm, language and generation.</h2>
        <p>Independent musicians, bands, choirs, DJs, gospel artists, jazz and folk performers, comedians, poets, festivals, churches, campuses, venues, promoters and cultural organisations.</p>
        <div className={styles.actions}><Link className={styles.primary} href={applyHref}>{applicationsOpen ? 'Start your artist application →' : 'Register for a controlled pilot →'}</Link><Link className={styles.secondary} href="/legal/creator-agreement">Read creator terms</Link></div>
        <small>KORA is family-safe. Pornography and explicit sexual content are not permitted. Artists retain their intellectual property by default and accept transparent commercial terms before monetisation.</small>
      </section>
    </main>
  );
}

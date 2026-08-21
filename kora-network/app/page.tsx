import Link from 'next/link';
import { brand } from '@/lib/brand';
import { featured, channels } from '@/lib/catalog';
import styles from './home.module.css';

const genres = [
  ['🎬', 'Drama & Film'],
  ['🎵', 'Music'],
  ['😂', 'Comedy'],
  ['⚽', 'Sport & Culture'],
  ['✨', 'Faith & Family'],
  ['🌍', 'African Stories'],
];

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.kicker}><span className={styles.pulse} /> AFRICA&apos;S CREATOR-FIRST DIGITAL TV NETWORK</div>
          <h1 className={styles.title}>Our stories.<span>Our screen.</span>Our economy.</h1>
          <p className={styles.lead}>{brand.description} KORA brings live channels, on-demand originals, creator television, family entertainment and measurable brand partnerships into one colourful African network.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/watch">Start watching →</Link>
            <Link className={styles.secondary} href="/live">Explore live TV</Link>
          </div>
          <div className={styles.micro}>
            <span>Family-safe</span><span>Creator-first</span><span>Live + On Demand</span><span>Viewer rewards from cleared revenue</span>
          </div>
        </div>
        <div className={styles.stage} aria-label="KORA entertainment universe">
          <div className={styles.orb} aria-hidden="true" />
          <div className={`${styles.floatCard} ${styles.one}`}><small>KORA ORIGINALS</small><strong>Stories that feel like home.</strong></div>
          <div className={`${styles.floatCard} ${styles.two}`}><small>LIVE & LOUD</small><strong>Africa&apos;s sound. One stage.</strong></div>
          <div className={`${styles.floatCard} ${styles.three}`}><small>CREATOR TV</small><strong>Publish. Grow. Participate.</strong></div>
        </div>
      </section>

      <div className={styles.ticker} aria-hidden="true"><div className={styles.tickerTrack}>
        <span>LIVE TV</span><span>SHORT DRAMA</span><span>MUSIC</span><span>COMEDY</span><span>FAITH</span><span>KIDS</span><span>CREATOR TV</span>
        <span>LIVE TV</span><span>SHORT DRAMA</span><span>MUSIC</span><span>COMEDY</span><span>FAITH</span><span>KIDS</span><span>CREATOR TV</span>
      </div></div>

      <section className={styles.section}>
        <header className={styles.sectionHead}><div className={styles.eyebrow}>WHATEVER YOUR VIBE</div><h2>There is a place for it on KORA.</h2><p>Built to feel fresh for younger viewers, familiar for families, and proudly African for audiences everywhere.</p></header>
        <div className={styles.genres}>{genres.map(([icon, label]) => <article className={styles.genre} key={label}><span>{icon}</span><strong>{label}</strong></article>)}</div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHead}><div className={styles.eyebrow}>FEATURED NOW</div><h2>Big feeling. New voices.</h2><p>Discover the mix KORA is built for—from short drama and music to faith, family and creator-led entertainment.</p></header>
        <div className={styles.showGrid}>{featured.map((show) => <article className={styles.show} key={show.title}>{show.badge ? <small>{show.badge}</small> : <small>{show.genre}</small>}<h3>{show.title}</h3><p>{show.description}</p></article>)}</div>
        <div className={styles.actions}><Link className={styles.primary} href="/watch">Browse On Demand</Link></div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHead}><div className={styles.eyebrow}>KORA LIVE</div><h2>Television that never sleeps.</h2><p>Digital channels bring premieres, music, drama, family viewing and creator programming together around the clock.</p></header>
        <div className={styles.channelGrid}>{channels.map((channel, index) => <article className={styles.channel} key={channel}><span className={styles.live}>{index < 2 ? '● LIVE' : '24/7'}</span><b>{channel}</b><small>{index === 0 ? 'Flagship entertainment and premieres.' : index === 1 ? 'Binge-worthy African drama.' : 'Curated African programming.'}</small></article>)}</div>
        <div className={styles.actions}><Link className={styles.secondary} href="/live">Open live guide →</Link></div>
      </section>

      <section className={styles.split}>
        <article className={styles.creator}><div className={styles.eyebrow}>FOR CREATORS</div><h2>Your story. Your audience. Your IP.</h2><p>KORA gives filmmakers and creators a structured route from application to moderated publication, accepted commercial terms, analytics and controlled payouts.</p><div className={styles.steps}><div><span>1</span><div><b>Apply & qualify</b><small>Rights, safety and audience fit are reviewed.</small></div></div><div><span>2</span><div><b>Publish through Studio</b><small>Upload securely and send work to moderation.</small></div></div><div><span>3</span><div><b>Grow transparently</b><small>Track accepted deals, revenue and payout status.</small></div></div></div><div className={styles.actions}><Link className={styles.primary} href="/creators">Creator opportunities →</Link></div></article>
        <article className={styles.brand}><div className={styles.eyebrow}>FOR BRANDS</div><h2>Reach culture, not just clicks.</h2><p>Plan family-safe contextual campaigns, sponsor programmes, submit approved creative and measure verified delivery without behavioural profiling of children.</p><div className={styles.steps}><div><span>1</span><div><b>Plan the campaign</b><small>Budget, dates and reward allocation stay transparent.</small></div></div><div><span>2</span><div><b>Approve creative</b><small>Human review protects viewers and the brand.</small></div></div><div><span>3</span><div><b>Measure delivery</b><small>Reporting is based on trusted platform events.</small></div></div></div><div className={styles.actions}><Link className={styles.primary} href="/advertise">Advertise on KORA →</Link></div></article>
      </section>

      <section className={styles.economy}>
        <div className={styles.eyebrow}>A HEALTHIER ATTENTION ECONOMY</div><h2>Value moves only after real value arrives.</h2><p>Viewer cash rewards are separated from site credits and funded from cleared campaign revenue. Creator allocations are protected from double-spending against those reward reserves. That makes the model understandable before it becomes exciting.</p>
        <div className={styles.flow}><div><strong>1. Brands fund</strong><small>Campaign money clears before reward pools activate.</small></div><div><strong>2. Viewers engage</strong><small>Only trusted, verified completion events qualify.</small></div><div><strong>3. Creators participate</strong><small>Accepted revenue-share terms govern creator allocation.</small></div><div><strong>4. KORA reconciles</strong><small>Ledgers, entitlements and payouts remain auditable.</small></div></div>
      </section>

      <section className={styles.cta}><div className={styles.eyebrow}>THE NEXT AFRICAN SCREEN</div><h2>Watch it. Build it. Back it.</h2><p>KORA is one network for audiences, creators and brands—designed to grow from Africa to the world without losing the people who make the stories matter.</p><div className={styles.actions}><Link className={styles.dark} href="/account">My KORA</Link><Link className={styles.secondary} href="/creators">Create on KORA</Link><Link className={styles.secondary} href="/advertise">Partner with KORA</Link></div></section>
    </main>
  );
}

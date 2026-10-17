import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';
import styles from './creator.module.css';

export default async function Creators() {
  const release = await getPlatformReleaseState();
  const applicationsOpen = release.creator_applications_enabled;
  const primaryHref = applicationsOpen ? '/creators/apply' : '/login?next=/creators/apply';
  const primaryLabel = applicationsOpen ? 'Become a KORA Creator' : 'Invited creator sign in';

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <video className={styles.video} autoPlay muted loop playsInline preload="metadata" poster="/kora-creator-welcome-poster.svg" aria-label="KORA creator welcome film">
          <source src="/media/kora-creator-welcome.mp4" type="video/mp4" />
        </video>
        <div className={styles.film} />
        <div className={styles.videoFallback} aria-label="KORA Creator Welcome Film">
          <div className={styles.play}>▶</div>
          <div className={styles.videoLabel}>KORA CREATOR WELCOME FILM • 60–90 SEC</div>
        </div>
        <div className={styles.heroInner}>
          <div className={styles.eyebrow}>KORA CREATOR • AFRICA → THE WORLD</div>
          <h1>Your story.<br /><span>Your audience.</span><br />The world.</h1>
          <p>You created the work. You built the audience. KORA gives your content a premium home designed for discovery, distribution and sustainable creator economics.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={primaryHref}>{primaryLabel} →</Link>
            <Link className={styles.secondary} href="/watch">Explore KORA first</Link>
          </div>
          <div className={styles.stats}>
            <div><strong>01</strong><span>YOUR CHANNEL</span></div>
            <div><strong>∞</strong><span>GLOBAL DISCOVERY</span></div>
            <div><strong>24/7</strong><span>CONTENT DESTINATION</span></div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.eyebrow}>WATCH THE WELCOME FILM</div>
        <h2>Don't take our word for it.<br />See what KORA is building.</h2>
        <p className={styles.sectionIntro}>Every creator should understand KORA before they apply. The welcome film introduces who we are, what we do, and how your work can move from a social post into a professional entertainment property.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="#creator-economy">See the creator journey ↓</Link>
          <Link className={styles.secondary} href="/legal/creator-agreement">Read creator terms</Link>
        </div>
      </section>

      <section className={styles.section} id="creator-economy">
        <div className={styles.eyebrow}>THE KORA CREATOR JOURNEY</div>
        <h2>From creation to global audience.</h2>
        <div className={styles.steps}>
          {[
            ['01','CREATE','Your work stays yours by default, subject to the deal you choose.'],
            ['02','PUBLISH','Package films, series, music, live events and creator programming professionally.'],
            ['03','DISCOVER','Give audiences another destination to find, follow and watch your work.'],
            ['04','MONETIZE','Eligible deals can support advertising, sponsorship, subscriptions, premium access and events.'],
            ['05','GROW','Use audience insight and KORA distribution to build a larger media business.'],
          ].map(([number,title,text]) => <article className={styles.step} key={number}><b>{number}</b><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.eyebrow}>SEE YOUR WORK DIFFERENTLY</div>
        <h2>We want creators to experience the platform before they commit.</h2>
        <p className={styles.sectionIntro}>KORA is being built with a rich showcase catalogue so prospective creators can see the standard: premium presentation, discovery rails, live programming, music, sport, family entertainment and creator-led channels. Showcase content will be properly licensed or produced for KORA.</p>
        <div className={styles.showcase}>
          <article className={styles.showcaseCard}><div className={styles.eyebrow}>KORA SHOWCASE</div><h3>Your content can live here.</h3><p>From an independent film to a music performance or creator series, KORA is designed to make the work feel like a professional entertainment property.</p></article>
          <article className={styles.showcaseCard}><div className={styles.eyebrow}>CREATOR STUDIO</div><h3>See the business behind the content.</h3><p>Accepted creators can access their deal, credited revenue, wallet and payout history through the creator experience.</p></article>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.eyebrow}>FOUNDING CREATOR PIPELINE</div>
        <h2>Don't just post your story.<br />Build its future.</h2>
        <p>Filmmakers, independent studios, writers, actor-creators, comedians, musicians and documentary makers can apply. KORA reviews audience fit, rights readiness, quality and safety before issuing any creator deal.</p>
        <div className={styles.actions} style={{justifyContent:'center'}}><Link className={styles.primary} href={primaryHref}>{applicationsOpen ? 'Submit your creator application' : 'Join the controlled launch'} →</Link><Link className={styles.secondary} href="/music">Explore KORA Music</Link></div>
      </section>
    </main>
  );
}

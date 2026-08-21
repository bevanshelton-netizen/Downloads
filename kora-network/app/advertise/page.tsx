import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';
import styles from './advertise.module.css';

export default async function Advertise() {
  const release = await getPlatformReleaseState();
  const campaignsOpen = release.advertiser_campaigns_enabled;
  const primaryHref = campaignsOpen ? '/advertiser' : '/login?next=/advertiser';
  const primaryLabel = campaignsOpen ? 'Open advertiser workspace' : 'Invited brand partner sign in';

  return (
    <main className={styles.page} id="main-content">
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>KORA FOR BRANDS</div>
          <h1>Reach culture, not just clicks.</h1>
          <p>Build measurable campaigns around African entertainment, creators and communities. KORA combines contextual video advertising, show sponsorship, verified delivery, transparent campaign economics and carefully controlled viewer rewards.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={primaryHref}>{primaryLabel} →</Link>
            <Link className={styles.secondary} href="/legal/advertiser-terms">Read advertiser terms</Link>
          </div>
          {!campaignsOpen ? <p className={styles.note}><strong>Brand campaigns are currently in controlled launch.</strong> Invited partners can sign in while public campaign creation remains closed.</p> : null}
        </div>
        <div className={styles.board} aria-label="KORA brand partnership formats">
          <article className={`${styles.tile} ${styles.one}`}><small>VIDEO CAMPAIGNS</small><strong>Context that fits the story.</strong><span>Approved creative • Trusted delivery</span></article>
          <article className={`${styles.tile} ${styles.two}`}><small>SPONSORSHIP</small><strong>Own a moment audiences remember.</strong><span>Shows • Genres • Premieres • Creator formats</span></article>
          <article className={`${styles.tile} ${styles.three}`}><small>VERIFIED REWARDS</small><strong>Fund attention responsibly.</strong><span>Cleared money first • Verified completion only</span></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.intro}><div className={styles.eyebrow}>PARTNERSHIP FORMATS</div><h2>Built for brands that want to belong in culture.</h2><p>KORA is designed for more than interruptive ads. Brands can participate in entertainment through clearly governed formats while viewers, creators and advertisers retain understandable boundaries.</p></div>
        <div className={styles.grid}>
          <article className={styles.card}><span>▶️</span><h3>Contextual video</h3><p>Place approved video creative against appropriate content and audience context without behavioural profiling of children.</p></article>
          <article className={styles.card}><span>🎬</span><h3>Show sponsorship</h3><p>Back a programme, season, premiere, creator challenge or cultural moment with commercial terms agreed in advance.</p></article>
          <article className={styles.card}><span>🛍️</span><h3>Story commerce</h3><p>Build future shoppable integrations around wardrobe, food, venues and products without confusing advertising with editorial content.</p></article>
          <article className={styles.card}><span>🎁</span><h3>Viewer rewards</h3><p>Deliberately allocate part of a real campaign budget to verified sponsored-view rewards after campaign money has cleared.</p></article>
          <article className={styles.card}><span>📊</span><h3>Aggregate reporting</h3><p>See trusted delivery, spend and completion reporting while KORA minimises unnecessary personal data collection.</p></article>
          <article className={styles.card}><span>🌍</span><h3>Pan-African reach</h3><p>Partner with emerging and established African storytellers through a network built to scale across genres and territories.</p></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.intro}><div className={styles.eyebrow}>WHAT THE PLATFORM MEASURES</div><h2>Commercial visibility without pretending every view is equal.</h2><p>KORA separates campaign planning from trusted operational delivery and only credits reward-bearing events after verification.</p></div>
        <div className={styles.metrics}>
          <div className={styles.metric}><b>Funded spend</b><small>Campaign funding and reward allocation remain visible as separate amounts.</small></div>
          <div className={styles.metric}><b>Approved creative</b><small>Human review is required before creative can enter delivery.</small></div>
          <div className={styles.metric}><b>Verified completion</b><small>Reward claims require a trusted completed sponsored-view event.</small></div>
          <div className={styles.metric}><b>Aggregate outcomes</b><small>Campaign reporting focuses on useful performance totals rather than invasive profiling.</small></div>
        </div>
      </section>

      <section className={styles.guard}>
        <div className={styles.eyebrow}>THE KORA COMMERCIAL GUARDRAIL</div><h2>Reward money is not imaginary money.</h2><p>KORA does not promise cash from uncollected advertising. Viewer reward pools activate from cleared campaign revenue, and creator revenue allocation is protected from spending the same cleared rand twice.</p>
        <div className={styles.guardGrid}><div><b>Cleared revenue first</b><small>Campaign funding must exist before cash reward pools are created.</small></div><div><b>Verified events only</b><small>Sponsored-view rewards require trusted completion, not a browser claim.</small></div><div><b>Auditable ledgers</b><small>Revenue events, reward claims and creator allocations remain traceable.</small></div></div>
      </section>

      <section className={styles.cta}>
        <div className={styles.eyebrow}>PARTNER WITH THE NEXT AFRICAN SCREEN</div><h2>Put your brand where the stories are going.</h2><p>Invited partners can enter the campaign workspace now. Public campaign creation only opens when KORA operations deliberately enables it.</p>
        <div className={styles.actions}><Link className={styles.primary} href={primaryHref}>{primaryLabel}</Link><Link className={styles.secondary} href="/legal/privacy">Privacy approach</Link></div>
      </section>
    </main>
  );
}

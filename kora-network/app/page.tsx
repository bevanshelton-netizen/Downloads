import Image from 'next/image';
import Link from 'next/link';
import ShareButton from '@/components/ShareButton';
import styles from './home.module.css';

const ecosystem = [
  ['📺', 'KORA TV', 'Movies, series, documentaries and KORA Originals.', '/watch'],
  ['🔴', 'KORA LIVE', 'Live channels, events and broadcast experiences.', '/live'],
  ['🎵', 'KORA MUSIC', 'Artists, albums, playlists, performances and music video.', '/music'],
  ['▶️', 'KORA VIDEO', 'Creator video, shorts, education and culture.', '/watch'],
  ['🎧', 'KORA AUDIO', 'Podcasts, audiobooks, spoken word and radio-style audio.', '/music'],
  ['🧒', 'KORA KIDS', 'A dedicated destination for children and families.', '/kids'],
  ['⚽', 'KORA SPORTS', 'Rights-cleared sports, highlights and live experiences.', '/live'],
  ['✦', 'KORA CREATOR', 'Creator hubs, audiences, memberships and analytics.', '/creators'],
  ['🎟️', 'KORA EVENTS', 'Concerts, festivals, conferences, masterclasses and hybrid events.', '/events'],
  ['🛍️', 'KORA COMMERCE', 'Tickets, merchandise, courses and digital products.', '/events'],
  ['💳', 'KORA PAY', 'Subscriptions, PPV, memberships, tips and creator earnings.', '/account'],
  ['🌍', 'KORA GLOBAL', 'Connect African creativity with audiences and partners worldwide.', '/global'],
];

const doors = [
  ['PUBLIC', 'For viewers, fans and audiences', 'Watch, listen, follow creators, discover channels, attend events and share what you love.', '/watch'],
  ['ENTERPRISE', 'For brands, broadcasters and institutions', 'Launch channels, campaigns, events, sponsorships and audience experiences on KORA.', '/partner'],
  ['GLOBAL', 'For international entertainment', 'Build the corridor between Africa and the world through artists, rights, events and distribution.', '/global'],
];

const featured = [
  ['/images/kora-hero-entertainment.webp', 'KORA TV', 'Africa to the World', 'Premium African entertainment and creator-led stories.'],
  ['/images/kora-original-drama.webp', 'KORA ORIGINALS', 'Stories That Feel Like Home', 'Original drama, film and documentary experiences.'],
  ['/images/kora-live-music.webp', 'KORA LIVE', 'The Stage Is Open', 'Music, showcases and live culture where rights permit.'],
];

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <nav className={styles.topbar} aria-label="KORA navigation">
        <Link href="/" className={styles.brand} aria-label="KORA home"><span className={styles.brandOrb}>K</span><span><b>KORA</b><em>GLOBAL</em><small>AFRICA</small></span></Link>
        <div className={styles.navLinks}><Link href="/watch">Watch</Link><Link href="/live">Live</Link><Link href="/music">Music</Link><Link href="/creators">Creators</Link><Link href="/events">Events</Link><Link href="/global">Global</Link></div>
        <div className={styles.navActions}><button className={styles.searchButton} aria-label="Search KORA">⌕</button><Link href="/account" aria-label="Profile / Account">◯</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroImageWrap}><Image src="/images/kora-hero-entertainment.webp" alt="KORA African digital entertainment" fill priority sizes="100vw" className={styles.heroImage} /></div>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroBrand}>KORA</div><div className={styles.heroStream}>AFRICA'S DIGITAL</div><div className={styles.heroAfrica}>ENTERTAINMENT HOME</div>
          <p className={styles.tagline}>WATCH • LISTEN • CREATE • GO LIVE • ATTEND • CONNECT • GROW</p>
          <p className={styles.heroText}>Television, live channels, music, video, audio, kids, sports, creators, events, commerce and global entertainment — one connected African-first ecosystem.</p>
          <div className={styles.heroActions}><Link href="/watch" className={styles.primary}>EXPLORE KORA</Link><Link href="/creators" className={styles.secondary}>CREATE ON KORA</Link><ShareButton title="KORA" text="Discover KORA — Africa's digital entertainment home." className={styles.secondary} /></div>
        </div>
      </section>

      <section className={styles.categorySection} aria-labelledby="explore-kora">
        <div className={styles.sectionIntro}><small>ONE ACCOUNT. EVERY FORMAT.</small><h1 id="explore-kora">The KORA ecosystem.</h1><p>Not just movies. KORA connects the formats, audiences and businesses that make African entertainment move.</p></div>
        <div className={styles.categoryGrid}>
          {ecosystem.map(([icon, label, description, href]) => <Link href={href} className={styles.categoryCard} key={label}>
            <div className={styles.cardContent}><span className={styles.cardIcon}>{icon}</span><h2>{label}</h2><p>{description}</p><b>Explore →</b></div>
          </Link>)}
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>THREE DOORS. ONE NETWORK.</small><h2>KORA for everyone.</h2></div></div>
        <div className={styles.featureGrid}>
          {doors.map(([label, title, description, href], index) => <Link href={href} className={styles.featureCard} key={label}>
            <div className={styles.featureIcon}>{['◉','◎','🌍'][index]}</div><div><small>KORA {label}</small><h3>{title}</h3><p>{description}</p></div><b>Enter KORA {label} →</b>
          </Link>)}
        </div>
      </section>

      <section className={styles.countrySection}>
        <div><small>KORA CREATOR</small><h2>Don’t just upload.<br />Build your world.</h2><p>A creator identity can become a television home: profile, channel, music, videos, live events, audience, memberships, merch and earnings — connected in one place.</p><Link href="/creators" className={styles.primary}>BUILD A CREATOR HUB →</Link></div>
        <div className={styles.countryGrid}>{['Your Profile','Your Channel','Your Music','Your Videos','Your Live Events','Your Audience','Your Members','Your Money'].map((item) => <Link href="/creators" key={item}>{item}<span>→</span></Link>)}</div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>KORA LIVE</small><h2>Television built for now.</h2></div><Link href="/live">Open Live →</Link></div>
        <div className={styles.featureGrid}>
          {['KORA ONE','KORA MUSIC','KORA DRAMA','KORA FAMILY','KORA FAITH','KORA KIDS'].map((channel, index) => <Link href="/live" className={styles.featureCard} key={channel}><div className={styles.featureIcon}>{['K','♫','🎭','♥','✝','●'][index]}</div><div><small>CHANNEL</small><h3>{channel}</h3><p>Discover live programming, channels and event-led experiences.</p></div><b>Open channel →</b></Link>)}
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>FEATURED</small><h2>Stories, sound and live culture.</h2></div><Link href="/watch">Browse all →</Link></div>
        <div className={styles.featureGrid}>
          {featured.map(([image, badge, title, description]) => <Link href="/watch" className={styles.featureCard} key={title}><Image src={image} alt={title} fill sizes="(max-width: 700px) 92vw, 30vw" /><span className={styles.cardShade} /><div className={styles.featureText}><small>{badge}</small><h3>{title}</h3><p>{description}</p><b>Explore now →</b></div></Link>)}
        </div>
      </section>

      <section className={styles.countrySection}>
        <div><small>KORA GLOBAL</small><h2>From Africa<br />to the world.</h2><p>Connect African artists, creators, rights holders and entertainment businesses with international audiences, partners, events and distribution.</p><Link href="/global" className={styles.primary}>ENTER KORA GLOBAL →</Link></div>
        <div className={styles.countryGrid}>{['Africa → Europe','Africa → Korea','Africa → Americas','Africa → Middle East','Africa → Asia','World → Africa','Rights & Distribution','Global Events'].map((item) => <Link href="/global" key={item}>{item}<span>→</span></Link>)}</div>
      </section>

      <section className={styles.creatorSection}>
        <div className={styles.creatorCard}><span>🎟️</span><small>KORA EVENTS</small><h2>Create → Sell → Stream.</h2><p>Concerts, festivals, gospel, comedy, conferences, masterclasses, sports and hybrid events.</p><Link href="/events">Create an event →</Link></div>
        <div className={styles.creatorCard}><span>🤝</span><small>KORA PARTNER</small><h2>Build with Africa.</h2><p>For broadcasters, brands, creators, rights holders, institutions and strategic partners.</p><Link href="/partner">Partner with KORA →</Link></div>
      </section>

      <section className={styles.finalCta}><div className={styles.finalBrand}>KORA <span>GLOBAL</span> AFRICA</div><h2>WATCH. LISTEN. CREATE.<br /><em>GO LIVE. CONNECT. GROW.</em></h2><p>African creativity deserves a digital home built for Africa — and ready for the world.</p><div className={styles.heroActions}><Link href="/watch" className={styles.primary}>EXPLORE KORA</Link><Link href="/account" className={styles.secondary}>JOIN KORA</Link><ShareButton title="KORA" text="Discover KORA — Africa's digital entertainment home." className={styles.secondary} /></div></section>
    </main>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import ShareButton from '@/components/ShareButton';
import styles from './home.module.css';

const categories = [
  ['🎬', 'Movies', '/watch', '/images/kora-hero-entertainment.webp', 'African and international films.'],
  ['📺', 'Series', '/watch', '/images/kora-original-drama.webp', 'Stories, drama and episodic entertainment.'],
  ['🎵', 'Music', '/music', '/images/kora-live-music.webp', 'Music, performances and African sound.'],
  ['🧒', 'Kids', '/kids', '/images/kora-original-drama.webp', 'Family-friendly entertainment for young audiences.'],
  ['📡', 'Channels', '/live', '/images/kora-hero-entertainment.webp', 'Discover KORA channels in one place.'],
  ['🔴', 'Live TV', '/live', '/images/kora-live-music.webp', 'Live programming, news, sport and events.'],
  ['🌍', 'Browse by Country', '/countries', '/images/kora-hero-entertainment.webp', 'Explore stories from across Africa.'],
  ['🤝', 'Partner With Kora', '/partner', '/images/kora-original-drama.webp', 'Creators, broadcasters and commercial partners.'],
  ['🎥', 'Submit Your Film', '/submit', '/images/kora-original-drama.webp', 'Put your film or series in front of KORA audiences.'],
  ['👤', 'Profile / Account', '/account', '/images/kora-hero-entertainment.webp', 'Manage your profile, watchlist and preferences.'],
];

const featured = [
  ['/images/kora-hero-entertainment.webp', 'KORA PREMIERE', 'Africa to the World', 'Explore premium African entertainment.'],
  ['/images/kora-original-drama.webp', 'KORA ORIGINALS', 'Stories That Feel Like Home', 'Creator-led stories built for African audiences.'],
  ['/images/kora-live-music.webp', 'KORA LIVE', 'The Stage Is Open', 'Music, showcases and live culture.'],
];

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <nav className={styles.topbar} aria-label="KORA Stream Africa navigation">
        <Link href="/" className={styles.brand} aria-label="KORA Stream Africa home">
          <span className={styles.brandOrb}>K</span>
          <span><b>KORA</b><em>STREAM</em><small>AFRICA</small></span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/watch">Movies</Link>
          <Link href="/watch">Series</Link>
          <Link href="/music">Music</Link>
          <Link href="/kids">Kids</Link>
          <Link href="/live">Channels</Link>
          <Link href="/live">Live TV</Link>
          <Link href="/countries">Countries</Link>
        </div>
        <div className={styles.navActions}><button className={styles.searchButton} aria-label="Search KORA">⌕</button><Link href="/account" aria-label="Profile / Account">◯</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroImageWrap}>
          <Image src="/images/kora-hero-entertainment.webp" alt="African entertainment on KORA Stream Africa" fill priority sizes="100vw" className={styles.heroImage} />
        </div>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroBrand}>KORA</div>
          <div className={styles.heroStream}>STREAM</div>
          <div className={styles.heroAfrica}>AFRICA</div>
          <p className={styles.tagline}>AFRICA'S STORIES • AFRICA'S MUSIC • AFRICA'S PEOPLE • TO THE WORLD</p>
          <p className={styles.heroText}>A streaming platform built around Africa's movies, series, music, kids, channels, live television, creators and countries.</p>
          <div className={styles.heroActions}>
            <Link href="/live" className={styles.primary}>▶ WATCH NOW</Link>
            <Link href="/watch" className={styles.secondary}>EXPLORE KORA</Link>
            <ShareButton title="KORA Stream Africa" text="Discover KORA Stream Africa — Africa's screen to the world." className={styles.secondary} />
          </div>
        </div>
      </section>

      <section className={styles.categorySection} aria-labelledby="explore-kora">
        <div className={styles.sectionIntro}>
          <small>KORA STREAM AFRICA</small>
          <h1 id="explore-kora">More than movies.</h1>
          <p>Everything KORA stands for is visible from the home page. Choose a world to explore.</p>
        </div>
        <div className={styles.categoryGrid}>
          {categories.map(([icon, label, href, image, description]) => (
            <Link href={href} className={styles.categoryCard} key={label}>
              <Image src={image} alt="" fill sizes="(max-width: 650px) 92vw, (max-width: 1050px) 45vw, 22vw" />
              <span className={styles.cardShade} />
              <div className={styles.cardContent}><span className={styles.cardIcon}>{icon}</span><h2>{label}</h2><p>{description}</p><b>Explore →</b></div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>FEATURED ON KORA</small><h2>Stories worth discovering.</h2></div><Link href="/watch">See all →</Link></div>
        <div className={styles.featureGrid}>
          {featured.map(([image, badge, title, description]) => (
            <Link href="/watch" className={styles.featureCard} key={title}>
              <Image src={image} alt={title} fill sizes="(max-width: 700px) 92vw, 30vw" />
              <span className={styles.cardShade} />
              <div className={styles.featureText}><small>{badge}</small><h3>{title}</h3><p>{description}</p><b>Watch now →</b></div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.countrySection}>
        <div><small>BROWSE BY COUNTRY</small><h2>One continent.<br />Many voices.</h2><p>Discover entertainment, creators, channels and stories by country — giving African audiences a place to see their own markets represented.</p><Link href="/countries" className={styles.primary}>BROWSE COUNTRIES →</Link></div>
        <div className={styles.countryGrid}>
          {['South Africa', 'Nigeria', 'Ghana', 'Kenya', 'Zimbabwe', 'Tanzania', 'DRC', 'More Africa'].map((country) => <Link href="/countries" key={country}>{country}<span>→</span></Link>)}
        </div>
      </section>

      <section className={styles.creatorSection}>
        <div className={styles.creatorCard}><span>🤝</span><small>PARTNER WITH KORA</small><h2>Build with Africa.</h2><p>For broadcasters, brands, creators, distributors and strategic partners.</p><Link href="/partner">Partner with KORA →</Link></div>
        <div className={styles.creatorCard}><span>🎥</span><small>SUBMIT YOUR FILM</small><h2>Put your story on KORA.</h2><p>Give African filmmakers and storytellers a direct route into the KORA ecosystem.</p><Link href="/submit">Submit your film →</Link></div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalBrand}>KORA <span>STREAM</span> AFRICA</div>
        <h2>AFRICA'S SCREEN.<br /><em>TO THE WORLD.</em></h2>
        <p>Watch it. Discover it. Create it. Share it.</p>
        <div className={styles.heroActions}><Link href="/live" className={styles.primary}>START WATCHING</Link><Link href="/account" className={styles.secondary}>CREATE ACCOUNT</Link><ShareButton title="KORA Stream Africa" text="Discover KORA Stream Africa — Africa's screen to the world." className={styles.secondary} /></div>
      </section>
    </main>
  );
}

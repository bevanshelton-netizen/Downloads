import Image from 'next/image';
import Link from 'next/link';
import { featured, channels } from '@/lib/catalog';
import styles from './home.module.css';

const categories = [
  ['◉', 'Live TV', '/live'],
  ['▦', 'News', '/live'],
  ['⚽', 'Sports', '/live'],
  ['▶', 'Movies & Series', '/watch'],
  ['♪', 'Music', '/music'],
  ['✦', 'KORA Originals', '/watch'],
  ['♥', 'Faith & Family', '/gospel'],
  ['●', 'Kids', '/kids'],
];

const heroCards = [
  ['/images/kora-hero-entertainment.webp', 'KORA PREMIERE', 'Africa to the World', 'Original entertainment, live television and creator stories.'],
  ['/images/kora-live-music.webp', 'KORA LIVE', 'The Stage Is Open', 'Concerts, showcases and music culture — live when rights permit.'],
  ['/images/kora-original-drama.webp', 'KORA ORIGINALS', 'Stories That Feel Like Home', 'Drama, film and creator-led entertainment built for African audiences.'],
];

const channelNames = channels.slice(0, 8);

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <nav className={styles.topbar} aria-label="KORA TV navigation">
        <Link href="/" className={styles.logo} aria-label="KORA TV home"><span className={styles.logoMark}>K</span><span>KORA <b>TV</b></span></Link>
        <div className={styles.navLinks}>
          <Link href="/live">Live</Link><Link href="/watch">On Demand</Link><Link href="/music">Music</Link><Link href="/gospel">Faith</Link><Link href="/kids">Kids</Link>
        </div>
        <div className={styles.navActions}><button className={styles.searchButton} aria-label="Search KORA">⌕</button><Link href="/account" className={styles.profile}>◯</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroCopy}>
          <div className={styles.liveBadge}><span /> LIVE + ON DEMAND</div>
          <h1>AFRICA<br /><em>TO THE WORLD.</em></h1>
          <p>Live TV, news, sports, movies, series, music and African originals — one premium entertainment destination.</p>
          <div className={styles.heroActions}><Link href="/live" className={styles.primary}>▶ Watch Live</Link><Link href="/watch" className={styles.secondary}>Explore KORA</Link></div>
          <div className={styles.heroMeta}><span>HD STREAMING</span><i /> <span>WEB • MOBILE • TV</span><i /> <span>AFRICAN-FIRST</span></div>
        </div>
        <div className={styles.heroVisual}>
          <Image src={heroCards[0][0]} alt="KORA TV entertainment" fill priority sizes="(max-width: 900px) 100vw, 56vw" className={styles.heroImage} />
          <div className={styles.heroVignette} />
          <div className={styles.playerChrome}><span>● LIVE</span><span>1080P</span><span>▣</span></div>
          <div className={styles.nowPlaying}><small>NOW PLAYING</small><strong>KORA PRIME</strong><span>Original African entertainment</span></div>
        </div>
      </section>

      <section className={styles.categoryBar} aria-label="Browse categories">
        {categories.map(([icon, label, href]) => <Link key={label} href={href} className={styles.category}><span>{icon}</span><b>{label}</b></Link>)}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}><div><small>LIVE CHANNELS</small><h2>What's on now</h2></div><Link href="/live">See all channels →</Link></div>
        <div className={styles.liveGrid}>
          {channelNames.map((channel, index) => <Link href="/live" className={styles.liveCard} key={channel}>
            <div className={`${styles.channelArt} ${styles[`art${index % 4}`]}`}><span className={styles.channelIcon}>{['K','A','N','S'][index % 4]}</span><span className={styles.liveDot}>● LIVE</span><div className={styles.channelWave} /></div>
            <div className={styles.liveInfo}><strong>{channel}</strong><span>{index % 2 === 0 ? 'Now playing' : 'Live programming'}</span><small>{index % 3 === 0 ? 'HD' : 'LIVE'}</small></div>
          </Link>)}
        </div>
      </section>

      <section className={styles.sectionDark}>
        <div className={styles.sectionTitle}><div><small>KORA ORIGINALS</small><h2>Made here. Seen everywhere.</h2></div><Link href="/watch">Browse originals →</Link></div>
        <div className={styles.posterGrid}>
          {heroCards.map(([image, badge, title, description], index) => <Link href="/watch" className={styles.poster} key={title}>
            <Image src={image} alt={title} fill sizes="(max-width: 700px) 90vw, 30vw" />
            <div className={styles.posterShade} />
            <div className={styles.posterText}><small>{badge}</small><h3>{title}</h3><p>{description}</p><span>Watch now →</span></div>
          </Link>)}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}><div><small>SPORTS • NEWS • ENTERTAINMENT</small><h2>Your world, one screen.</h2></div></div>
        <div className={styles.featureGrid}>
          <Link href="/live" className={styles.featureCard}><div className={styles.featureIcon}>⚽</div><div><small>SPORTS</small><h3>Never miss the moment.</h3><p>Live sports, highlights and a future-ready sports hub built for African audiences.</p></div><b>Open Sports →</b></Link>
          <Link href="/live" className={styles.featureCard}><div className={styles.featureIcon}>▤</div><div><small>NEWS</small><h3>Fast. Clear. African.</h3><p>News programming and current-affairs channels with room for local voices.</p></div><b>Open News →</b></Link>
          <Link href="/music" className={styles.featureCard}><div className={styles.featureIcon}>♫</div><div><small>MUSIC</small><h3>Turn up the continent.</h3><p>Music, radio, concerts and artist-led programming in one entertainment layer.</p></div><b>Open Music →</b></Link>
        </div>
      </section>

      <section className={styles.watchStrip}>
        <div><small>WATCH ANYWHERE</small><h2>One KORA account.<br />Every screen.</h2><p>Designed for phones, tablets, browsers and connected TV experiences, with adaptive streaming for changing network conditions.</p></div>
        <div className={styles.deviceStack}><div className={styles.tvMock}><div className={styles.tvScreen}><span>KORA</span><b>TV</b></div></div><div className={styles.phoneMock}><div><b>KORA</b><span>LIVE</span></div></div><div className={styles.tabletMock}><span>▶</span></div></div>
      </section>

      <section className={styles.pricing}>
        <div><small>KORA PLUS</small><h2>Entertainment without the clutter.</h2><p>Start with free and ad-supported experiences, then unlock premium programming as licensed content and partner offers come online.</p></div>
        <div className={styles.plan}><span>COMING NEXT</span><strong>Premium</strong><b>Multi-screen entertainment</b><ul><li>Premium channels</li><li>Originals & early access</li><li>Replay & catch-up where licensed</li><li>Family profiles</li></ul><Link href="/account" className={styles.primary}>Join KORA →</Link></div>
      </section>

      <section className={styles.finalCta}><div className={styles.logoLarge}><span className={styles.logoMark}>K</span>KORA <b>TV</b></div><h2>THE NEXT AFRICAN SCREEN.</h2><p>Watch it. Create it. Own the future of entertainment.</p><div className={styles.heroActions}><Link href="/live" className={styles.primary}>Start Watching</Link><Link href="/creators" className={styles.secondary}>Create on KORA</Link></div></section>
    </main>
  );
}

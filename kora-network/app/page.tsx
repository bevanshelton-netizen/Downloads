import Image from 'next/image';
import Link from 'next/link';
import ShareButton from '@/components/ShareButton';
import styles from './home.module.css';

const menu = [
  ['HOME', '/', '⌂'],
  ['MOVIES', '/watch', '🎬'],
  ['SERIES', '/watch', '▣'],
  ['MUSIC', '/music', '♫'],
  ['KIDS', '/kids', '●'],
  ['CHANNELS', '/live', '▤'],
  ['LIVE TV', '/live', '◉'],
  ['BROWSE BY COUNTRY', '/global', '◎'],
  ['PARTNER WITH KORA', '/partners', '↗'],
  ['SUBMIT YOUR FILM', '/partners', '▸'],
  ['PROFILE / ACCOUNT', '/account', '○'],
];

const networkCards = [
  ['01', 'MOVIES', 'African cinema, independent film, classics and original stories.', '/watch'],
  ['02', 'SERIES', 'Drama, comedy, documentaries and episodic African storytelling.', '/watch'],
  ['03', 'MUSIC', 'Amapiano, Afrobeats, gospel, Afrohouse, artists and performances.', '/music'],
  ['04', 'KIDS', 'Safe, intelligent and joyful programming for African children and families.', '/kids'],
  ['05', 'CHANNELS', 'A growing home for African channels, broadcasters and specialist networks.', '/live'],
  ['06', 'LIVE TV', 'Live programming, premieres, events and broadcast experiences.', '/live'],
];

const countries = ['SOUTH AFRICA', 'NIGERIA', 'GHANA', 'KENYA', 'ZIMBABWE', 'TANZANIA', 'CAMEROON', 'DRC', 'ETHIOPIA', 'SENEGAL', 'AFRICA & DIASPORA'];

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="KORA Stream Africa home">
          <span className={styles.brandOrb}>K</span>
          <span className={styles.brandWords}><b>KORA</b><em>STREAM</em><small>AFRICA</small></span>
        </Link>

        <nav className={styles.desktopNav} aria-label="KORA navigation">
          {menu.slice(0, 8).map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
        </nav>

        <div className={styles.actions}>
          <Link href="/account" className={styles.profile} aria-label="Profile / Account">○</Link>
          <details className={styles.mobileMenu}>
            <summary aria-label="Open KORA menu">☰</summary>
            <div className={styles.menuPanel}>
              <div className={styles.menuHeading}>KORA <span>STREAM AFRICA</span></div>
              {menu.map(([label, href, icon]) => <Link href={href} key={label}><span>{icon}</span>{label}</Link>)}
            </div>
          </details>
        </div>
      </header>

      <section className={styles.hero}>
        <Image src="/images/kora-hero-entertainment.webp" alt="African entertainment and culture on KORA Stream Africa" fill priority sizes="100vw" className={styles.heroImage} />
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <p className={styles.kicker}>AFRICAN-FIRST • GLOBAL-READY</p>
          <h1>KORA<br /><span>STREAM AFRICA</span></h1>
          <p className={styles.heroLead}>A digital entertainment network built around Africa — its people, stories, music, languages, cultures, creators and audiences.</p>
          <div className={styles.heroActions}>
            <Link href="/watch" className={styles.primary}>ENTER KORA</Link>
            <Link href="#network" className={styles.secondary}>EXPLORE THE NETWORK</Link>
          </div>
          <p className={styles.heroNote}>NOT ANOTHER MOVIE APP.</p>
        </div>
        <div className={styles.heroRail} aria-hidden="true"><span>WATCH</span><span>LISTEN</span><span>CREATE</span><span>GO LIVE</span><span>CONNECT</span></div>
      </section>

      <section className={styles.statement}>
        <div className={styles.statementMark}>K</div>
        <div><p className={styles.kicker}>THE KORA DIFFERENCE</p><h2>KORA is a <em>network</em>, not a catalogue.</h2><p>We are not building a platform that simply places rows of titles on a screen. KORA brings the African entertainment ecosystem together: television, film, music, live channels, creators, children, countries, partners and the people who make the culture move.</p></div>
      </section>

      <section className={styles.network} id="network">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>THE FRONT DOOR</p><h2>Choose your world.</h2></div><p>Everything important is visible from the landing page. No hunting. No Netflix imitation. KORA tells visitors what the network is from the first screen.</p></div>
        <div className={styles.networkGrid}>
          {networkCards.map(([number, label, text, href]) => <Link href={href} className={styles.networkCard} key={label}><span>{number}</span><div><h3>{label}</h3><p>{text}</p></div><b>OPEN →</b></Link>)}
        </div>
      </section>

      <section className={styles.countryBand}>
        <div><p className={styles.kicker}>BROWSE BY COUNTRY</p><h2>Africa is not one story.</h2><p>Discover entertainment by country, language, culture and region. KORA gives every market a visible place in the network.</p><Link href="/global" className={styles.primary}>BROWSE AFRICA →</Link></div>
        <div className={styles.countryGrid}>{countries.map((country, i) => <Link href="/global" key={country}><span>{String(i + 1).padStart(2, '0')}</span>{country}<b>→</b></Link>)}</div>
      </section>

      <section className={styles.partnerSection}>
        <div className={styles.partnerCard}><p className={styles.kicker}>PARTNER WITH KORA</p><h2>Build the African entertainment economy with us.</h2><p>For broadcasters, brands, rights holders, institutions, distributors and strategic partners.</p><Link href="/partners">PARTNER WITH KORA →</Link></div>
        <div className={styles.partnerCard}><p className={styles.kicker}>SUBMIT YOUR FILM</p><h2>Your story deserves a route to an audience.</h2><p>Bring African film and original storytelling into the KORA ecosystem for consideration.</p><Link href="/partners">SUBMIT YOUR FILM →</Link></div>
      </section>

      <section className={styles.liveSection}>
        <div className={styles.liveCopy}><p className={styles.kicker}>LIVE TV • CHANNELS</p><h2>Television without borders.</h2><p>KORA is designed to grow beyond on-demand viewing into channels, live programming, events and broadcast partnerships.</p><Link href="/live" className={styles.secondary}>OPEN LIVE TV →</Link></div>
        <div className={styles.liveDial}><div className={styles.dialCenter}>KORA<br /><span>LIVE</span></div><i className={styles.tickOne}>01</i><i className={styles.tickTwo}>24</i><i className={styles.tickThree}>LIVE</i><i className={styles.tickFour}>AFRICA</i></div>
      </section>

      <section className={styles.creatorSection}>
        <div><p className={styles.kicker}>CREATORS</p><h2>From creator to channel.</h2><p>KORA gives African creators a path beyond posting: identity, audience, video, music, live experiences, events, commerce and community.</p><Link href="/creators" className={styles.primary}>BUILD YOUR KORA WORLD →</Link></div>
        <div className={styles.creatorList}><div>PROFILE <span>YOUR IDENTITY →</span></div><div>CHANNEL <span>YOUR AUDIENCE →</span></div><div>LIVE <span>YOUR MOMENT →</span></div><div>COMMERCE <span>YOUR BUSINESS →</span></div></div>
      </section>

      <section className={styles.finalCta}>
        <p className={styles.kicker}>WELCOME TO KORA</p>
        <h2>AFRICA HAS A<br /><em>HOME ON SCREEN.</em></h2>
        <p>Movies. Series. Music. Kids. Channels. Live TV. Countries. Creators. Partners. Stories.</p>
        <div className={styles.heroActions}><Link href="/watch" className={styles.primary}>WATCH NOW</Link><Link href="/account" className={styles.secondary}>PROFILE / ACCOUNT</Link><ShareButton title="KORA Stream Africa" text="Discover KORA — African entertainment, live TV, music, creators and stories." className={styles.secondary} /></div>
      </section>
    </main>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import ShareButton from '@/components/ShareButton';
import styles from './home.module.css';

const genres = [
  ['🎬','MOVIES','African cinema, features and independent film'],
  ['📺','SERIES','Drama, comedy, serials and premium episodic stories'],
  ['🎭','DRAMA','Human stories, African originals and television drama'],
  ['😂','COMEDY','Stand-up, sketch, comedy series and funny creators'],
  ['✝️','GOSPEL & FAITH','Gospel music, sermons, worship and faith programming'],
  ['🎵','MUSIC','Amapiano, Afrobeats, Afrohouse, gospel and global sounds'],
  ['⚽','SPORTS','Rights-cleared sport, highlights and live experiences'],
  ['🧒','KIDS & FAMILY','Safe, educational and entertaining family programming'],
  ['📰','NEWS & CURRENT AFFAIRS','African news, interviews, analysis and public affairs'],
  ['🎥','DOCUMENTARY','History, people, places, investigations and real stories'],
  ['🌍','CULTURE & HERITAGE','Languages, traditions, arts, heritage and identity'],
  ['✨','LIFESTYLE','Fashion, beauty, wellness, homes, people and trends'],
  ['🍲','FOOD & TRAVEL','African food, destinations, tourism and discovery'],
  ['🎙️','TALK & REALITY','Talk shows, reality, interviews and social stories'],
  ['📚','EDUCATION','Learning, masterclasses, skills and knowledge'],
  ['🎮','YOUTH & GAMING','Youth culture, gaming, creators and interactive entertainment'],
  ['🎤','LIVE EVENTS','Concerts, festivals, comedy, conferences and premieres'],
  ['🌐','AFRICAN LANGUAGES','Programming across the languages and regions of Africa'],
];

const ecosystem = [
  ['📺','KORA TV','Movies, series, documentaries and KORA Originals in one African-first television home.','/watch'],
  ['🔴','KORA LIVE','Live channels, live programming, premieres and event-led broadcast experiences.','/live'],
  ['🎵','KORA MUSIC','Artists, albums, playlists, performances, music videos and discovery.','/music'],
  ['▶️','KORA VIDEO','Creator video, shorts, education, culture and audience-first video channels.','/watch'],
  ['🎧','KORA AUDIO','Podcasts, audiobooks, spoken word and radio-style audio experiences.','/watch'],
  ['🧒','KORA KIDS','A dedicated destination for children and families with protected programming.','/kids'],
  ['⚽','KORA SPORTS','Rights-cleared sports, highlights, live experiences and sports communities.','/live'],
  ['✦','KORA CREATOR','Creator hubs, channels, followers, memberships, analytics and earnings.','/creators'],
  ['🎟️','KORA EVENTS','Concerts, festivals, gospel, comedy, conferences and hybrid events.','/events'],
  ['🛍️','KORA COMMERCE','Tickets, merchandise, courses, digital products and creator offers.','/events'],
  ['💳','KORA PAY','Subscriptions, PPV, memberships, tips and creator earnings.','/account'],
  ['🤝','KORA PARTNER','Infrastructure and distribution for broadcasters, brands, rights holders and institutions.','/partners'],
  ['🌍','KORA GLOBAL','Connect African creativity with international audiences, partners, rights and events.','/global'],
  ['🗺️','BROWSE BY COUNTRY','Discover African stories, creators and entertainment by country and region.','/global'],
];

const doors = [
  ['PUBLIC','For viewers, fans and audiences','Watch, listen, follow creators, discover channels, attend events and share what you love.','/watch'],
  ['ENTERPRISE','For brands, broadcasters and institutions','Launch channels, campaigns, events, sponsorships and audience experiences on KORA.','/partners'],
  ['GLOBAL','For international entertainment','Build the corridor between Africa and the world through artists, rights, events and distribution.','/global'],
];

const liveChannels = ['KORA ONE','KORA MUSIC','KORA DRAMA','KORA FAMILY','KORA FAITH','KORA KIDS'];
const creatorDestinations = ['Your Profile','Your Channel','Your Music','Your Videos','Your Live Events','Your Audience','Your Members','Your Money'];
const globalDestinations = ['Africa → Europe','Africa → Korea','Africa → Americas','Africa → Middle East','Africa → Asia','World → Africa','Rights & Distribution','Global Events'];
const cableChannels = [
  ['AFRICAN','AMusic Channel','Nigerian music and entertainment','FAST Channels TV'],
  ['AFRICAN','Aforevo 2','African stories and drama','FAST Channels TV'],
  ['AFRICAN','Mama Benz TV','African women, culture and lifestyle','FAST Channels TV'],
  ['AFRICAN','Nigbati TV','Yoruba culture, entertainment and language','FAST Channels TV'],
  ['AFRICAN','Teen Africa','Family, education and entertainment','FAST Channels TV'],
  ['AFRICAN','X2DTV','Music, dance, comedy, fashion, food and arts','FAST Channels TV'],
  ['AFRICAN','Nolly Africa','Nollywood and African movies and series','FAST Channels TV'],
  ['AFRICAN','4ACETV AFROBEAT','Amapiano, Afrobeats and Afrohouse','FAST Channels TV'],
  ['AFRICAN','Africanews English','African news and current affairs','FAST Channels TV'],
  ['GLOBAL','The Africa Channel','Pan-African stories for global and diaspora audiences','Strategic licensing target'],
];

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <nav className={styles.topbar} aria-label="KORA navigation">
        <Link href="/" className={styles.brand} aria-label="KORA Stream Africa home">
          <span className={styles.brandOrb}>K</span>
          <span><b>KORA</b><em>STREAM</em><small>AFRICA</small></span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/watch">Explore</Link><Link href="#genres">Genres</Link><Link href="/live">Live TV</Link><Link href="/music">Music</Link><Link href="/kids">Kids</Link><Link href="/creators">Creators</Link><Link href="/advertise">Advertise</Link><Link href="/events">Events</Link><Link href="/global">Countries</Link><Link href="/partners">Partner</Link>
        </div>
        <div className={styles.navActions}><button className={styles.searchButton} aria-label="Search KORA">⌕</button><Link href="/account" aria-label="Profile / Account">◯</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroImageWrap}><Image src="/images/kora-hero-entertainment.webp" alt="KORA Stream Africa entertainment" fill priority sizes="100vw" className={styles.heroImage} /></div>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroBrand}>KORA</div>
          <div className={styles.heroStream}>STREAM AFRICA</div>
          <div className={styles.heroAfrica}>AFRICA'S DIGITAL ENTERTAINMENT HOME.</div>
          <p className={styles.tagline}>WATCH • LISTEN • CREATE • GO LIVE • ATTEND • CONNECT • GROW</p>
          <p className={styles.heroText}>Not another movie app. KORA is an African-first entertainment network connecting television, music, video, audio, sport, kids, creators, live channels, events, commerce and the world.</p>
          <div className={styles.heroActions}><Link href="/watch" className={styles.primary}>ENTER KORA</Link><Link href="#genres" className={styles.secondary}>EXPLORE ALL GENRES</Link><ShareButton title="KORA Stream Africa" text="Discover KORA — African entertainment, live TV, music, creators and events." className={styles.secondary} /></div>
        </div>
      </section>

      <section className={styles.categorySection} id="genres" aria-labelledby="genre-title">
        <div className={styles.sectionIntro}><small>THE KORA UNIVERSE</small><h1 id="genre-title">Every genre. From the first screen.</h1><p>KORA does not make you choose between television, music, sport, culture or creators. The landing page opens the whole world — so audiences can go straight to what they love.</p></div>
        <div className={styles.categoryGrid}>{genres.map(([icon,label,description]) => <Link href="/watch" className={styles.categoryCard} key={label}><div className={styles.cardContent}><span className={styles.cardIcon}>{icon}</span><h2>{label}</h2><p>{description}</p><b>Explore →</b></div></Link>)}</div>
      </section>

      <section className={styles.categorySection}>
        <div className={styles.sectionIntro}><small>ONE ACCOUNT. EVERY FORMAT.</small><h2>The KORA ecosystem.</h2><p>One connected network for audiences, creators, broadcasters, brands and global entertainment partners.</p></div>
        <div className={styles.categoryGrid}>{ecosystem.map(([icon,label,description,href]) => <Link href={href} className={styles.categoryCard} key={label}><div className={styles.cardContent}><span className={styles.cardIcon}>{icon}</span><h2>{label}</h2><p>{description}</p><b>Explore →</b></div></Link>)}</div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>THREE DOORS. ONE NETWORK.</small><h2>KORA for everyone.</h2></div></div>
        <div className={styles.featureGrid}>{doors.map(([label,title,description,href],index) => <Link href={href} className={styles.featureCard} key={label}><div className={styles.featureIcon}>{['◉','◎','🌍'][index]}</div><div><small>KORA {label}</small><h3>{title}</h3><p>{description}</p></div><b>Enter KORA {label} →</b></Link>)}</div>
      </section>

      <section className={styles.countrySection}>
        <div><small>KORA CREATOR</small><h2>Don’t just upload.<br />Build your world.</h2><p>A creator identity can become a television home: profile, channel, music, videos, live events, audience, memberships, merch and earnings — connected in one place.</p><Link href="/creators" className={styles.primary}>BUILD A CREATOR HUB →</Link></div>
        <div className={styles.countryGrid}>{creatorDestinations.map(item => <Link href="/creators" key={item}>{item}<span>→</span></Link>)}</div>
      </section>

      <section className={styles.creatorSection}>
        <div className={styles.creatorCard}><span>✦</span><small>KORA CREATOR ECONOMY</small><h2>Turn attention into sustainable revenue.</h2><p>Creators can build audiences, memberships, events, commerce and earnings while KORA keeps commercial rewards tied to cleared revenue and verified activity.</p><Link href="/creators">Explore creator revenue →</Link></div>
        <div className={styles.creatorCard}><span>🎁</span><small>CLEARED-REVENUE REWARDS</small><h2>Reward real participation.</h2><p>Eligible rewards are funded from cleared revenue pools and verified events — not promises, simulated balances or unverified income.</p><Link href="/advertise">Explore KORA advertising →</Link></div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>KORA LIVE</small><h2>Television built for now.</h2></div><Link href="/live">Open Live →</Link></div>
        <div className={styles.featureGrid}>{liveChannels.map((channel,index) => <Link href="/live" className={styles.featureCard} key={channel}><div className={styles.featureIcon}>{['K','♫','🎭','♥','✝','●'][index]}</div><div><small>CHANNEL</small><h3>{channel}</h3><p>Discover live programming, channels and event-led experiences.</p></div><b>Open channel →</b></Link>)}</div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.sectionTitle}><div><small>KORA CABLE</small><h2>African channels. One guide.</h2></div><Link href="/live">Open EPG →</Link></div>
        <div className={styles.featureGrid}>{cableChannels.map(([type,name,description,source]) => <Link href="/live" className={styles.featureCard} key={name}><div className={styles.featureIcon}>📡</div><div><small>{type} • {source}</small><h3>{name}</h3><p>{description}. Availability remains subject to rights, territory and commercial approval.</p></div><b>Request channel →</b></Link>)}</div>
      </section>

      <section className={styles.countrySection}>
        <div><small>KORA GLOBAL</small><h2>From Africa<br />to the world.</h2><p>Connect African artists, creators, rights holders and entertainment businesses with international audiences, partners, events and distribution.</p><Link href="/global" className={styles.primary}>ENTER KORA GLOBAL →</Link></div>
        <div className={styles.countryGrid}>{globalDestinations.map(item => <Link href="/global" key={item}>{item}<span>→</span></Link>)}</div>
      </section>

      <section className={styles.creatorSection}>
        <div className={styles.creatorCard}><span>🎟️</span><small>KORA EVENTS</small><h2>Create → Sell → Stream.</h2><p>Concerts, festivals, gospel, comedy, conferences, masterclasses, sports and hybrid events.</p><Link href="/events">Create an event →</Link></div>
        <div className={styles.creatorCard}><span>🤝</span><small>KORA PARTNER</small><h2>Build with Africa.</h2><p>For broadcasters, brands, creators, rights holders, institutions and strategic partners.</p><Link href="/partners">Partner with KORA →</Link></div>
      </section>

      <section className={styles.finalCta}><div className={styles.finalBrand}>KORA <span>STREAM</span> AFRICA</div><h2>WATCH. LISTEN. CREATE.<br /><em>GO LIVE. CONNECT. GROW.</em></h2><p>African creativity deserves a digital home built for Africa — and ready for the world.</p><div className={styles.heroActions}><Link href="/watch" className={styles.primary}>WATCH NOW</Link><Link href="/account" className={styles.secondary}>JOIN KORA</Link><ShareButton title="KORA Stream Africa" text="Discover KORA — African entertainment, live TV, music, creators and events." className={styles.secondary} /></div></section>
    </main>
  );
}

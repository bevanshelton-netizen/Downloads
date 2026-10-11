import Link from 'next/link';
import styles from './tv.module.css';

const platforms = [
  { icon: '🌐', name: 'KORA Web TV', status: 'LIVE', detail: 'Responsive OTT experience for browsers and desktop screens.', href: '/watch' },
  { icon: '📱', name: 'KORA Mobile', status: 'READY', detail: 'Mobile-first viewing, accounts, live channels and on-demand.', href: '/account' },
  { icon: '🤖', name: 'Android TV', status: 'NEXT', detail: 'Lean-back TV interface designed for remote control navigation.', href: '/watch' },
  { icon: '🔥', name: 'Fire TV', status: 'NEXT', detail: 'TV-optimised channel discovery and playback experience.', href: '/watch' },
  { icon: '🍎', name: 'Apple TV', status: 'NEXT', detail: 'Premium living-room experience using the same KORA service layer.', href: '/watch' },
  { icon: '📺', name: 'Smart TV', status: 'NEXT', detail: 'Progressive TV delivery for supported Smart TV ecosystems.', href: '/live' },
  { icon: '🟣', name: 'Roku', status: 'NEXT', detail: 'Channel-style distribution built around KORA live and VOD catalogues.', href: '/live' },
  { icon: '📡', name: 'Chromecast', status: 'READY', detail: 'Cast KORA from supported browsers and mobile devices.', href: '/watch' },
];

const services = ['Identity & profiles', 'Live channel guide', 'VOD catalogue', 'HLS playback', 'Subscriptions & entitlements', 'Advertising & sponsorship', 'Creator publishing', 'Analytics & reporting'];

export default function KoraTV() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>KORA TV PLATFORM</div>
        <h1>One KORA.<br /><span>Every screen.</span></h1>
        <p>We are turning KORA from a website into a multi-screen African television platform. One content, identity and commercial engine can power web, mobile, connected TV and future distribution partners.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/watch">Watch KORA →</Link>
          <Link className={styles.secondary} href="/live">Open Live TV</Link>
        </div>
        <div className={styles.heroStats}>
          <div><strong>8</strong><span>screen targets</span></div>
          <div><strong>1</strong><span>service layer</span></div>
          <div><strong>24/7</strong><span>TV vision</span></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>DEVICE EXPANSION</div>
          <h2>Built once. Distributed everywhere.</h2>
          <p>The cards below are the KORA distribution roadmap. LIVE means the service already exists in production; READY means the underlying web capability supports the experience; NEXT identifies the next native TV delivery layer.</p>
        </div>
        <div className={styles.grid}>
          {platforms.map((platform) => (
            <Link href={platform.href} className={styles.card} key={platform.name}>
              <div className={styles.cardTop}><span className={styles.icon}>{platform.icon}</span><b className={platform.status === 'LIVE' ? styles.live : platform.status === 'READY' ? styles.ready : styles.next}>{platform.status}</b></div>
              <h3>{platform.name}</h3>
              <p>{platform.detail}</p>
              <span className={styles.open}>Open KORA experience →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.engine}>
        <div>
          <div className={styles.eyebrow}>THE ENGINE</div>
          <h2>Every screen connects to the same KORA brain.</h2>
          <p>Device apps should not become separate businesses. They consume the same controlled service layer for catalogues, live streams, identities, entitlements, advertising, creator operations and analytics.</p>
        </div>
        <div className={styles.serviceGrid}>
          {services.map((service, i) => <div className={styles.service} key={service}><span>{String(i + 1).padStart(2, '0')}</span><strong>{service}</strong></div>)}
        </div>
      </section>

      <section className={styles.channels}>
        <div className={styles.eyebrow}>AFRICA → THE WORLD</div>
        <h2>And this is where KORA becomes bigger than an app.</h2>
        <div className={styles.flow}>
          <div><b>CONTENT</b><span>Creators, broadcasters, music, sport, faith, kids and originals.</span></div>
          <div><b>DISTRIBUTION</b><span>Web, mobile, connected TV, FAST and partner platforms.</span></div>
          <div><b>COMMERCE</b><span>Subscriptions, advertising, sponsorships and creator economics.</span></div>
          <div><b>DATA</b><span>Trusted viewing, campaign and platform analytics.</span></div>
        </div>
        <div className={styles.actions}><Link className={styles.primary} href="/creators">Build the creator economy →</Link><Link className={styles.secondary} href="/advertise">Power the sponsors →</Link></div>
      </section>
    </main>
  );
}

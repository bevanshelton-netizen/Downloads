import Link from 'next/link';
import TvRemoteShell from './TvRemoteShell';
import TvContentRails from './TvContentRails';
import TvIdentityBar from './TvIdentityBar';
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
  return <main className={styles.page}>
    <TvIdentityBar />
    <section className={styles.hero}>
      <div className={styles.eyebrow}>KORA TV PLATFORM</div><h1>One KORA.<br /><span>Every screen.</span></h1>
      <p>A cinematic, African-first television platform connecting live channels, VOD, creators, sports, music, faith and family entertainment through one service layer.</p>
      <div className={styles.actions}><Link className={styles.primary} href="/watch">Watch KORA →</Link><Link className={styles.secondary} href="/live">Open Live TV</Link></div>
      <div className={styles.heroStats}><div><strong>8</strong><span>screen targets</span></div><div><strong>1</strong><span>service layer</span></div><div><strong>24/7</strong><span>TV vision</span></div></div>
    </section>

    <TvRemoteShell />
    <TvContentRails />

    <section className={styles.section}>
      <div className={styles.sectionHead}><div className={styles.eyebrow}>DEVICE EXPANSION</div><h2>Built once. Distributed everywhere.</h2><p>The same KORA identity, catalogue, entitlement, playback and commercial services power every screen.</p></div>
      <div className={styles.grid}>{platforms.map((platform) => <Link href={platform.href} className={styles.card} key={platform.name}><div className={styles.cardTop}><span className={styles.icon}>{platform.icon}</span><b className={platform.status === 'LIVE' ? styles.live : platform.status === 'READY' ? styles.ready : styles.next}>{platform.status}</b></div><h3>{platform.name}</h3><p>{platform.detail}</p><span className={styles.open}>Open KORA experience →</span></Link>)}</div>
    </section>

    <section className={styles.engine}><div><div className={styles.eyebrow}>THE ENGINE</div><h2>Every screen connects to the same KORA brain.</h2><p>Device apps consume one controlled service layer instead of becoming separate businesses.</p></div><div className={styles.serviceGrid}>{services.map((service, i) => <div className={styles.service} key={service}><span>{String(i + 1).padStart(2, '0')}</span><strong>{service}</strong></div>)}</div></section>

    <section className={styles.channels}><div className={styles.eyebrow}>AFRICA → THE WORLD</div><h2>Content. Distribution. Commerce. Data.</h2><div className={styles.flow}><div><b>CONTENT</b><span>Creators, broadcasters, music, sport, faith, kids and originals.</span></div><div><b>DISTRIBUTION</b><span>Web, mobile, connected TV, FAST and partner platforms.</span></div><div><b>COMMERCE</b><span>Subscriptions, advertising, sponsorships and creator economics.</span></div><div><b>DATA</b><span>Trusted viewing, campaign and platform analytics.</span></div></div><div className={styles.actions}><Link className={styles.primary} href="/creators">Build the creator economy →</Link><Link className={styles.secondary} href="/advertise">Power the sponsors →</Link></div></section>
  </main>;
}

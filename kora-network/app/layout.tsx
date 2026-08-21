import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import './forms.css';
import './workspaces.css';
import { brand } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  applicationName: brand.name,
  title: { default: `${brand.name} | African Digital TV`, template: `%s | ${brand.name}` },
  description: brand.description,
  keywords: ['African streaming', 'African television', 'creator economy', 'live TV', 'African film', 'African music', 'family entertainment'],
  category: 'entertainment',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4c1fa8',
  colorScheme: 'dark',
};

function KoraMark() {
  return (
    <svg className="koraMark" viewBox="0 0 64 76" aria-hidden="true">
      <path className="koraNeck" d="M37 5v41" />
      <path className="koraBody" d="M13 47c0-13 9-22 24-22s24 9 24 22c0 14-10 24-24 24S13 61 13 47Z" />
      <path className="koraBridge" d="M21 47h32" />
      <path className="koraString" d="M29 12 24 47M33 9 30 47M37 7v40M41 11l2 36M45 16l4 31" />
      <circle cx="37" cy="48" r="4" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skipLink" href="#page-content">Skip to content</a>
        <header className="top">
          <Link className="logo" href="/" aria-label="KORA Network home"><KoraMark /><span className="logoWords"><b>{brand.name}</b><small>NETWORK</small></span></Link>
          <nav aria-label="Main navigation">
            <Link href="/open-africa">Watch Free</Link>
            <Link href="/music">Music</Link>
            <Link href="/watch">On Demand</Link>
            <Link href="/live">Live TV</Link>
            <Link href="/kids">Kids</Link>
            <Link href="/creators">Creators</Link>
            <Link href="/perform-live">Perform Live</Link>
            <Link href="/studio">Studio</Link>
            <Link href="/advertise">Advertise</Link>
          </nav>
          <Link className="pill" href="/account">My KORA</Link>
        </header>
        <div id="page-content" tabIndex={-1}>{children}</div>
        <footer>
          <div className="footerBrand"><div className="footerLogo"><KoraMark /><strong>{brand.name}</strong></div><span>Family-safe creator television • No pornography or explicit sexual content.</span></div>
          <div className="footerLinks" aria-label="Legal and policy links">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/content-policy">Safety</Link>
            <Link href="/legal/creator-agreement">Creators</Link>
            <Link href="/legal/advertiser-terms">Advertisers</Link>
            <Link href="/legal/copyright">Copyright</Link>
            <Link href="/legal/refunds">Refunds</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}

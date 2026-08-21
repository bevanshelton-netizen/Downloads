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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skipLink" href="#page-content">Skip to content</a>
        <header className="top">
          <Link className="logo" href="/" aria-label="KORA Network home">{brand.name}<span>NETWORK</span></Link>
          <nav aria-label="Main navigation">
            <Link href="/watch">On Demand</Link>
            <Link href="/live">Live TV</Link>
            <Link href="/kids">Kids</Link>
            <Link href="/creators">Creators</Link>
            <Link href="/studio">Studio</Link>
            <Link href="/advertise">Advertise</Link>
          </nav>
          <Link className="pill" href="/account">My KORA</Link>
        </header>
        <div id="page-content" tabIndex={-1}>{children}</div>
        <footer>
          <div className="footerBrand"><strong>{brand.name}</strong><span>Family-safe creator television • No pornography or explicit sexual content.</span></div>
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

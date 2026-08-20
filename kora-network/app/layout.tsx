import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './forms.css';
import './workspaces.css';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${brand.name} | African Digital TV`,
  description: brand.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link className="logo" href="/">{brand.name}<span>NETWORK</span></Link>
          <nav>
            <Link href="/watch">On Demand</Link>
            <Link href="/live">Live TV</Link>
            <Link href="/creators">Creators</Link>
            <Link href="/studio">Studio</Link>
            <Link href="/advertise">Advertise</Link>
          </nav>
          <Link className="pill" href="/account">My KORA</Link>
        </header>
        {children}
        <footer>
          <strong>{brand.name}</strong>
          <span>Family-safe creator television • No pornography or explicit sexual content.</span>
          <nav aria-label="Legal">
            <Link href="/legal#terms">Terms</Link>
            <Link href="/legal#privacy">Privacy</Link>
            <Link href="/legal#creator-agreement">Creators</Link>
            <Link href="/legal#advertiser-terms">Advertisers</Link>
            <Link href="/legal#refunds">Refunds</Link>
            <Link href="/legal#content-policy">Content policy</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}

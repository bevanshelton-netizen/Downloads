import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';

export default async function ComingSoon({ searchParams }: { searchParams: Promise<{ maintenance?: string }> }) {
  const [{ maintenance }, release] = await Promise.all([searchParams, getPlatformReleaseState()]);
  const isMaintenance = maintenance === '1' || release.maintenance_mode;
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">KORA NETWORK</div>
        <h1>{isMaintenance ? 'KORA is temporarily in maintenance.' : 'African stories are coming to a new screen.'}</h1>
        <p>{isMaintenance ? (release.maintenance_message || 'The network is temporarily unavailable while operations complete essential work.') : 'KORA is in controlled launch. Public access will open only after the network, payments, safety and operating systems have passed final production checks.'}</p>
        <div className="actions"><Link className="secondary" href="/login">Invited member sign in</Link></div>
      </section>
      <section className="grid three">
        <article className="panel"><h3>Live + On Demand</h3><p>African entertainment, vertical drama, music, faith, family programming and creator television.</p></article>
        <article className="panel"><h3>Creator-first</h3><p>Independent creators keep their IP by default and receive transparent monetisation terms.</p></article>
        <article className="panel"><h3>Family-safe</h3><p>Pornography and explicit sexual content are prohibited, with human moderation and dedicated Kids controls.</p></article>
      </section>
    </main>
  );
}

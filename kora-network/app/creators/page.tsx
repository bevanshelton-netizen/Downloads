import Link from 'next/link';
import { getPlatformReleaseState } from '@/lib/platform-state';

export default async function Creators() {
  const release = await getPlatformReleaseState();
  const applicationsOpen = release.creator_applications_enabled;
  const primaryHref = applicationsOpen ? '/creators/apply' : '/login?next=/creators/apply';
  const primaryLabel = applicationsOpen ? 'Apply as a creator' : 'Invited creator sign in';

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">FOR FILMMAKERS & CREATORS</div>
        <h1>Bring the story. We bring the network.</h1>
        <p>Publish short drama, films, documentaries, comedy, music and family programming while retaining your IP by default. KORA is building an African creator pipeline from emerging talent to commissioned Originals.</p>
        <div className="actions">
          <Link className="primary" href={primaryHref}>{primaryLabel}</Link>
          <Link className="secondary" href="/legal/creator-agreement">Read creator terms</Link>
        </div>
        {!applicationsOpen ? <p><strong>Founding creator applications are in controlled launch.</strong> Invited creators can sign in now; public applications will open from the KORA launch controls when operations are ready.</p> : null}
      </section>
      <section className="grid three">
        <article className="panel"><h3>Own your work</h3><p>Creator-friendly rights, transparent licensing options and no forced transfer of IP.</p></article>
        <article className="panel"><h3>Earn in layers</h3><p>Eligible content revenue can be allocated under a deal you see and accept before monetisation. Sponsorship, commerce and other formats can use separate commercial terms.</p></article>
        <article className="panel"><h3>See the numbers</h3><p>Creator Studio tracks your accepted deal, credited creator revenue, wallet balance and payout history.</p></article>
      </section>
      <section className="economy">
        <div><div className="eyebrow">KORA MUSIC • MANY GENRES, ONE NETWORK</div><h2>Your sound does not have to fit one box.</h2></div>
        <p>KORA is building discovery lanes for Amapiano, Afrobeats, Gospel, Jazz, Hip-Hop, R&amp;B, Soul, Reggae, Maskandi, Gqom, Kwaito, Rock, Classical, traditional music and emerging hybrid sounds.</p>
        <div className="actions"><Link className="primary" href="/music">Explore KORA Music</Link></div>
      </section>
      <section className="economy">
        <div><div className="eyebrow">LIVE CONCERTS ON KORA</div><h2>Turn your next performance into a global stage.</h2></div>
        <p>Founding artists can register for KORA’s controlled live-concert pilots, combining promotion, ticketing, sponsors, audience insight and replay in one campaign.</p>
        <div className="actions"><Link className="primary" href="/perform-live">Explore Perform Live on KORA</Link></div>
      </section>
      <section className="economy">
        <div><div className="eyebrow">FOUNDING CREATOR PIPELINE</div><h2>We are looking for the stories television has not found yet.</h2></div>
        <p>Filmmakers, independent studios, writers, actor-creators, comedians, musicians and documentary makers can apply. KORA reviews audience fit, rights readiness, quality and safety before issuing any creator deal.</p>
        <div className="actions"><Link className="primary" href={primaryHref}>{applicationsOpen ? 'Submit your creator application' : 'Join the controlled launch'}</Link></div>
      </section>
    </main>
  );
}

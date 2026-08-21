import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import styles from '../artists.module.css';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('artist_profiles').select('display_name,primary_genre,bio').eq('slug', slug).eq('is_published', true).maybeSingle();
  return data ? { title: data.display_name, description: `${data.display_name} on KORA — ${data.primary_genre}. ${data.bio.slice(0, 130)}` } : { title: 'Artist' };
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: artist } = await supabase
    .from('artist_profiles')
    .select('id,live_application_id,display_name,country_code,primary_genre,bio,portfolio_url,public_booking_email,website_url,social_url')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!artist) notFound();

  const { data: events } = await supabase
    .from('ticket_events')
    .select('id,title,slug,starts_at,event_mode,status,sales_enabled,venue_city')
    .eq('live_application_id', artist.live_application_id)
    .in('status', ['published','postponed','completed'])
    .order('starts_at');

  return (
    <main className={styles.page}>
      <section className={styles.profile}>
        <div className={styles.profileHero}>
          <div>
            <div className={styles.eyebrow}>KORA ARTIST • {artist.country_code} • {artist.primary_genre}</div>
            <h1>{artist.display_name}</h1>
            <p>{artist.bio}</p>
            <div className={styles.links}>
              {artist.portfolio_url ? <a className="primary" href={artist.portfolio_url} target="_blank" rel="noreferrer">Watch / listen ↗</a> : null}
              {artist.website_url ? <a className="secondary" href={artist.website_url} target="_blank" rel="noreferrer">Official website ↗</a> : null}
              {artist.social_url ? <a className="secondary" href={artist.social_url} target="_blank" rel="noreferrer">Social ↗</a> : null}
              {artist.public_booking_email ? <a className="secondary" href={`mailto:${artist.public_booking_email}`}>Booking enquiry</a> : null}
            </div>
          </div>
          <div className={styles.mark} aria-hidden="true">♪</div>
        </div>

        <section className={styles.events}>
          <div className={styles.eyebrow}>LIVE ON KORA</div>
          <h2>Events & replays</h2>
          {(events ?? []).length ? (
            <div className={styles.eventGrid}>
              {(events ?? []).map((event) => (
                <Link className={styles.event} href={`/tickets/${event.slug}`} key={event.id}>
                  <small>{event.status.toUpperCase()} • {event.event_mode.toUpperCase()}</small>
                  <h3>{event.title}</h3>
                  <p>{new Date(event.starts_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}{event.venue_city ? ` • ${event.venue_city}` : ''}</p>
                  <strong>{event.sales_enabled ? 'View tickets →' : 'Event preview →'}</strong>
                </Link>
              ))}
            </div>
          ) : <div className={styles.empty}>No public KORA event has been announced for this artist yet.</div>}
        </section>

        <div className={styles.privacy}>KORA publishes only curated artist information. Private application email addresses, identity documents, banking details and other protected verification data are never displayed on artist pages.</div>
        <div className={styles.links}><Link className="secondary" href="/artists">← All artists</Link><Link className="secondary" href="/music">Explore KORA Music</Link></div>
      </section>
    </main>
  );
}

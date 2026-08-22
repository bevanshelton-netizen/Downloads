import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { allMusicGenres } from '@/lib/music-genres';
import styles from './artists.module.css';

export const metadata: Metadata = {
  title: 'Artists',
  description: 'Discover approved KORA artists across African and global music genres.',
};

type PublicArtist = {
  id: string;
  live_application_id: string | null;
  slug: string;
  display_name: string;
  country_code: string;
  primary_genre: string;
  bio: string;
};

type PublicEvent = {
  id: string;
  live_application_id: string | null;
  title: string;
  slug: string;
  starts_at: string;
  event_mode: string;
  venue_city: string | null;
  sales_enabled: boolean;
};

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const { genre: requestedGenre } = await searchParams;
  const selectedGenre = requestedGenre && allMusicGenres.includes(requestedGenre) ? requestedGenre : null;
  let artists: PublicArtist[] = [];
  let events: PublicEvent[] = [];

  try {
    const supabase = await createClient();
    let artistQuery = supabase
      .from('artist_profiles')
      .select('id,live_application_id,slug,display_name,country_code,primary_genre,bio')
      .eq('is_published', true)
      .order('display_name');

    if (selectedGenre) artistQuery = artistQuery.ilike('primary_genre', `%${selectedGenre}%`);
    const artistResult = await artistQuery;
    artists = (artistResult.data ?? []) as PublicArtist[];

    const applicationIds = artists
      .map((artist) => artist.live_application_id)
      .filter((id): id is string => Boolean(id));

    if (applicationIds.length) {
      const eventResult = await supabase
        .from('ticket_events')
        .select('id,live_application_id,title,slug,starts_at,event_mode,venue_city,sales_enabled')
        .in('live_application_id', applicationIds)
        .in('status', ['published', 'postponed'])
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(12);
      events = (eventResult.data ?? []) as PublicEvent[];
    }
  } catch {
    artists = [];
    events = [];
  }

  const artistByApplication = new Map(
    artists
      .filter((artist) => artist.live_application_id)
      .map((artist) => [artist.live_application_id as string, artist]),
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>KORA ARTISTS • DISCOVER THE PEOPLE BEHIND THE SOUND</div>
        <h1>{selectedGenre ? selectedGenre : 'Find your next'}<br/><span>{selectedGenre ? 'on KORA.' : 'favourite artist.'}</span></h1>
        <p>Approved KORA artist pages bring genre, story, live events and public booking links into one discovery destination. Profiles are curated from verified artist pilots; private application contact details are never published automatically.</p>
        <div className={styles.actions}>
          <Link className="primary" href="/music">Browse all music genres →</Link>
          <Link className="secondary" href="/perform-live">Perform live on KORA</Link>
        </div>
      </section>

      <section className={styles.filterBar} aria-label="Artist discovery filter">
        <div>
          <div className={styles.eyebrow}>DISCOVERY LANE</div>
          <strong>{selectedGenre ? `Showing artists connected to ${selectedGenre}` : 'Showing all published KORA artists'}</strong>
          <p>Genre discovery accepts hybrid sounds too, so an artist can appear in more than one relevant lane.</p>
        </div>
        <div className={styles.filterActions}>
          {selectedGenre ? <Link href="/artists">Clear genre filter</Link> : null}
          <Link href="/music#genre-discovery">Choose another genre</Link>
        </div>
      </section>

      <section className={styles.grid}>
        {artists.length ? artists.map((artist) => (
          <Link className={styles.card} href={`/artists/${artist.slug}`} key={artist.id}>
            <div className={styles.portrait}><span aria-hidden="true">♪</span><b>KORA ARTIST</b></div>
            <div className={styles.body}>
              <div className={styles.meta}>{artist.country_code} • {artist.primary_genre}</div>
              <h2>{artist.display_name}</h2>
              <p>{artist.bio.slice(0, 170)}{artist.bio.length > 170 ? '…' : ''}</p>
              <strong>Open artist page →</strong>
            </div>
          </Link>
        )) : (
          <article className={styles.card}>
            <div className={styles.portrait}><span aria-hidden="true">♫</span><b>{selectedGenre ? selectedGenre.toUpperCase() : 'FOUNDING ARTISTS'}</b></div>
            <div className={styles.body}>
              <h2>{selectedGenre ? `Be among KORA’s first ${selectedGenre} artists.` : 'The first KORA artist pages are being prepared.'}</h2>
              <p>{selectedGenre ? `No curated ${selectedGenre} artist page is public yet. Artists can enter the controlled live-event pipeline now.` : 'Artists across every genre can enter the controlled live-event pipeline now. Public profiles appear only after approval and curation.'}</p>
              <Link className="primary" href="/perform-live">Join the founding artist pipeline</Link>
            </div>
          </article>
        )}
      </section>

      {events.length ? (
        <section className={`${styles.events} ${styles.directoryEvents}`}>
          <div className={styles.eyebrow}>UPCOMING ON KORA</div>
          <h2>{selectedGenre ? `${selectedGenre} events` : 'Live events from KORA artists'}</h2>
          <div className={styles.eventGrid}>
            {events.map((event) => {
              const artist = event.live_application_id ? artistByApplication.get(event.live_application_id) : null;
              return (
                <Link className={styles.event} href={`/tickets/${event.slug}`} key={event.id}>
                  <small>{artist?.display_name ?? 'KORA ARTIST'} • {event.event_mode.toUpperCase()}</small>
                  <h3>{event.title}</h3>
                  <p>{new Date(event.starts_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}{event.venue_city ? ` • ${event.venue_city}` : ''}</p>
                  <strong>{event.sales_enabled ? 'View tickets →' : 'Event preview →'}</strong>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

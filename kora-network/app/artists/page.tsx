import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import styles from './artists.module.css';

export const metadata: Metadata = {
  title: 'Artists',
  description: 'Discover approved KORA artists across African and global music genres.',
};

export default async function ArtistsPage() {
  const supabase = await createClient();
  const { data: artists } = await supabase
    .from('artist_profiles')
    .select('id,slug,display_name,country_code,primary_genre,bio')
    .eq('is_published', true)
    .order('display_name');

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>KORA ARTISTS • DISCOVER THE PEOPLE BEHIND THE SOUND</div>
        <h1>Find your next<br/><span>favourite artist.</span></h1>
        <p>Approved KORA artist pages bring genre, story, live events and public booking links into one discovery destination. Profiles are curated from verified artist pilots; private application contact details are never published automatically.</p>
        <div className={styles.actions}>
          <Link className="primary" href="/music">Browse music genres →</Link>
          <Link className="secondary" href="/perform-live">Perform live on KORA</Link>
        </div>
      </section>

      <section className={styles.grid}>
        {(artists ?? []).length ? (artists ?? []).map((artist) => (
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
            <div className={styles.portrait}><span aria-hidden="true">♫</span><b>FOUNDING ARTISTS</b></div>
            <div className={styles.body}>
              <h2>The first KORA artist pages are being prepared.</h2>
              <p>Artists across every genre can enter the controlled live-event pipeline now. Public profiles appear only after approval and curation.</p>
              <Link className="primary" href="/perform-live">Join the founding artist pipeline</Link>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

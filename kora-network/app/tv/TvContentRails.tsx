'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import styles from './tv-content.module.css';

type Production = { id: string; title: string; slug: string; synopsis?: string | null; genre?: string | null; primary_language?: string | null };
type Episode = { id: string; production_id: string; episode_number: number; title: string; duration_seconds: number };
type LiveChannel = { id: string; name: string; slug: string; description?: string | null };
type ContinueItem = { episodeId: string; productionId: string; secondsWatched: number; durationSeconds: number };
type Feed = { authenticated: boolean; productions: Production[]; episodes: Episode[]; liveChannels: LiveChannel[]; continueWatching: ContinueItem[] };

export default function TvContentRails() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch('/api/ott/home', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then(setFeed)
      .catch(() => setFeed(null));
  }, []);

  const filteredProductions = useMemo(() => {
    if (!feed || !search.trim()) return feed?.productions ?? [];
    const query = search.trim().toLowerCase();
    return feed.productions.filter((item) => [item.title, item.synopsis, item.genre, item.primary_language].some((value) => value?.toLowerCase().includes(query)));
  }, [feed, search]);

  if (!feed) return <section className={styles.loading}>Loading KORA programming…</section>;

  const productionById = new Map(feed.productions.map((item) => [item.id, item]));
  const episodeById = new Map(feed.episodes.map((item) => [item.id, item]));

  return <section className={styles.content} aria-label="KORA live and on-demand catalogue">
    <div className={styles.searchBar}>
      <button type="button" className={styles.searchToggle} onClick={() => setSearchOpen((value) => !value)} aria-expanded={searchOpen}>⌕ SEARCH</button>
      {searchOpen && <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearch(''); setSearchOpen(false); } }} placeholder="Search KORA programming…" aria-label="Search KORA programming" />}
    </div>

    {search.trim() && <Rail title={`SEARCH RESULTS · ${filteredProductions.length}`}>
      {filteredProductions.slice(0, 12).map((production) => <Link className={styles.card} href={`/watch/${production.slug}`} key={production.id}><span className={styles.kicker}>{production.genre || 'KORA'}</span><strong>{production.title}</strong><span>{production.synopsis || 'Watch now on KORA.'}</span></Link>)}
      {!filteredProductions.length && <div className={styles.empty}>No matching KORA programming yet.</div>}
    </Rail>}

    {feed.continueWatching.length > 0 && <Rail title="CONTINUE WATCHING">{feed.continueWatching.map((item) => {
      const production = productionById.get(item.productionId);
      const episode = episodeById.get(item.episodeId);
      if (!production || !episode) return null;
      const percent = Math.min(99, Math.round((item.secondsWatched / Math.max(1, item.durationSeconds)) * 100));
      return <Link className={styles.card} href={`/watch/${production.slug}`} key={item.episodeId}><span className={styles.kicker}>RESUME · {percent}%</span><strong>{production.title}</strong><span>{episode.title}</span><i style={{ width: `${percent}%` }} /></Link>;
    })}</Rail>}

    <Rail title="LIVE NOW">{feed.liveChannels.map((channel) => <Link className={styles.card} href={`/live?channel=${encodeURIComponent(channel.slug)}`} key={channel.id}><span className={styles.live}>● LIVE</span><strong>{channel.name}</strong><span>{channel.description || 'Watch live on KORA'}</span></Link>)}</Rail>

    <Rail title="FEATURED VOD">{feed.productions.slice(0, 12).map((production) => <Link className={styles.card} href={`/watch/${production.slug}`} key={production.id}><span className={styles.kicker}>{production.genre || 'KORA ORIGINAL'}</span><strong>{production.title}</strong><span>{production.synopsis || 'Watch now on KORA.'}</span></Link>)}</Rail>

    {['Music', 'Sports', 'Faith', 'Kids'].map((genre) => {
      const items = feed.productions.filter((production) => (production.genre || '').toLowerCase().includes(genre.toLowerCase()));
      if (!items.length) return null;
      return <Rail title={`KORA ${genre.toUpperCase()}`} key={genre}>{items.map((production) => <Link className={styles.card} href={`/watch/${production.slug}`} key={production.id}><span className={styles.kicker}>{production.primary_language || 'AFRICA'}</span><strong>{production.title}</strong><span>{production.synopsis || `Discover ${genre.toLowerCase()} on KORA.`}</span></Link>)}</Rail>;
    })}
  </section>;
}

function Rail({ title, children }: { title: string; children: ReactNode }) {
  return <div className={styles.rail}><h2>{title}</h2><div className={styles.row}>{children}</div></div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './tv-remote.module.css';

const rails = [
  { id: 'live', label: 'LIVE NOW', items: ['KORA TV Live', 'KORA Music', 'KORA Sports', 'KORA Faith'] },
  { id: 'featured', label: 'FEATURED FOR YOU', items: ['African Stories', 'KORA Originals', 'New Voices', 'World Stage'] },
  { id: 'kids', label: 'KORA KIDS', items: ['Kids Live', 'African Animation', 'Learning', 'Family Picks'] },
  { id: 'music', label: 'KORA MUSIC', items: ['Afrobeats', 'Gospel', 'Amapiano', 'Live Sessions'] },
];

export default function TvRemoteShell() {
  const [focus, setFocus] = useState('nav-0');
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const ids = ['nav-0', 'nav-1', 'nav-2', 'nav-3', ...rails.flatMap((r) => r.items.map((_, i) => `${r.id}-${i}`))];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = ids.indexOf(focus);
      let next = current;
      if (event.key === 'ArrowRight') next = Math.min(ids.length - 1, current + 1);
      if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
      if (event.key === 'ArrowDown') next = Math.min(ids.length - 1, current + 4);
      if (event.key === 'ArrowUp') next = Math.max(0, current - 4);
      if (next !== current) { event.preventDefault(); setFocus(ids[next]); refs.current[ids[next]]?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, ids]);

  return (
    <section className={styles.shell} aria-label="KORA TV remote experience">
      <nav className={styles.nav} aria-label="TV navigation">
        {['Home', 'Live', 'Movies', 'Sports'].map((item, i) => {
          const id = `nav-${i}`;
          return <Link key={id} id={id} href={i === 1 ? '/live' : '/watch'} ref={(node) => { refs.current[id] = node; }} tabIndex={focus === id ? 0 : -1} onFocus={() => setFocus(id)} className={focus === id ? styles.focused : ''}>{item}</Link>;
        })}
      </nav>
      {rails.map((rail) => (
        <div className={styles.rail} key={rail.id}>
          <div className={styles.railTitle}>{rail.label}</div>
          <div className={styles.cards}>
            {rail.items.map((item, i) => {
              const id = `${rail.id}-${i}`;
              return <Link key={id} href={rail.id === 'live' ? '/live' : '/watch'} id={id} ref={(node) => { refs.current[id] = node; }} tabIndex={focus === id ? 0 : -1} onFocus={() => setFocus(id)} className={`${styles.card} ${focus === id ? styles.focused : ''}`}><span>{item}</span><small>WATCH →</small></Link>;
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

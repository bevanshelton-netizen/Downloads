import Link from 'next/link';
import { getBroadcastGuide } from '@/lib/broadcast';

const fallback = [
  ['KORA One','kora-one','Flagship African entertainment'],
  ['KORA Drama','kora-drama','African drama around the clock'],
  ['KORA Family','kora-family','Family-safe entertainment'],
  ['KORA Faith','kora-faith','Faith, values and inspiration'],
  ['KORA Music','kora-music','Music, performance and culture'],
  ['KORA Kids','kora-kids','Curated programming for children'],
  ['KORA Creators','kora-creators','Independent African creator showcase'],
] as const;

function catTime(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }).format(new Date(value));
}

export default async function Live() {
  const guide = await getBroadcastGuide();
  const channels = guide.length ? guide : fallback.map(([name, slug, description]) => ({ id: slug, name, slug, description, playback_url: null, logo_url: null, is_family_safe: true, now: null, next: null }));

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">LIVE TELEVISION • CAT</div>
        <h1>KORA Live</h1>
        <p>Seven digital channels with a real programme guide, scheduled premieres, continuous streams and live-event capability.</p>
      </section>
      <section className="channels large">
        {channels.map((channel) => (
          <article className="channel" key={channel.id}>
            <span className="live">{channel.now ? '● LIVE NOW' : '24/7 CHANNEL'}</span>
            <strong>{channel.name}</strong>
            <small>{channel.description}</small>
            {channel.now ? <p><b>Now:</b> {channel.now.title} • until {catTime(channel.now.ends_at)}</p> : <p>Channel stream ready for programming.</p>}
            {channel.next ? <small>Next: {channel.next.title} • {catTime(channel.next.starts_at)} CAT</small> : null}
            <Link className="secondary" href={`/live/${channel.slug}`}>Open channel</Link>
          </article>
        ))}
      </section>
    </main>
  );
}

import Link from 'next/link';
import { getBroadcastGuide } from '@/lib/broadcast';

function catTime(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }).format(new Date(value));
}

export default async function Live() {
  const channels = await getBroadcastGuide();

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">LIVE TELEVISION • CAT</div>
        <h1>KORA Live</h1>
        <p>Seven digital channels with a current programme guide, scheduled premieres, continuous-stream capability and live-event support.</p>
      </section>
      <section className="channels large">
        {channels.map((channel) => {
          const preview = channel.schedule_source === 'continuity-preview';
          return (
            <article className="channel" key={channel.id}>
              <span className="live">{channel.playback_url ? (channel.now ? '● STREAM READY' : 'STREAM READY') : '● PROGRAMMING'}</span>
              <strong
                style={{
                  display: 'block',
                  fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
                  fontWeight: 800,
                  lineHeight: 1.05,
                  margin: '0.4rem 0 0.6rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {channel.name}
              </strong>
              <small>{channel.description}</small>
              {channel.now ? <p><b>{preview ? 'Schedule preview:' : 'Now:'}</b> {channel.now.title} • until {catTime(channel.now.ends_at)}</p> : <p>No current programme is published.</p>}
              {channel.next ? <small>Next: {channel.next.title} • {catTime(channel.next.starts_at)} CAT</small> : null}
              <Link className="secondary" href={`/live/${channel.slug}`}>Open channel</Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}

import { notFound } from 'next/navigation';
import LivePlayer from '@/components/LivePlayer';
import { getChannel } from '@/lib/broadcast';

function catDateTime(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'
  }).format(new Date(value));
}

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getChannel(slug);
  if (!result) notFound();

  const now = new Date();
  const current = result.schedule.find((item) => new Date(item.starts_at) <= now && new Date(item.ends_at) > now) ?? null;

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA LIVE CHANNEL</div>
        <h1>{result.channel.name}</h1>
        <p>{result.channel.description}</p>
      </section>
      <section>
        <div className="broadcastStage">
          {result.channel.playback_url ? (
            <LivePlayer src={result.channel.playback_url} title={`${result.channel.name} live stream`} />
          ) : (
            <div className="broadcastStandby"><b>CHANNEL STANDBY</b><span>Connect the production HLS feed to begin broadcasting.</span></div>
          )}
        </div>
        <div className="panel">
          <span className="live">{current ? '● ON AIR' : 'PROGRAMME GUIDE'}</span>
          <h3>{current?.title ?? 'No programme currently scheduled'}</h3>
          {current?.sponsor_name ? <p>Presented with {current.sponsor_name}</p> : null}
        </div>
      </section>
      <section>
        <div className="sectionHead"><h2>Next 24 hours</h2><span>Central Africa Time</span></div>
        <div className="productionList">
          {result.schedule.length ? result.schedule.map((item) => (
            <div className="productionRow" key={item.id}>
              <strong>{catDateTime(item.starts_at)} • {item.title}</strong>
              <span>{item.is_premiere ? 'Premiere • ' : ''}{item.sponsor_name ? `Sponsored by ${item.sponsor_name}` : 'KORA programming'}</span>
            </div>
          )) : <div className="panel"><p>The schedule is being programmed.</p></div>}
        </div>
      </section>
    </main>
  );
}

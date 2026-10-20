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
  const next = result.schedule.find((item) => new Date(item.starts_at) > now) ?? null;
  const preview = result.schedule_source === 'continuity-preview';

  return (
    <main>
      <section className="subHero tvChannelHero">
        <div className="eyebrow">KORA LIVE CHANNEL • {result.channel.playback_url ? 'STREAM READY' : 'STANDBY'}</div>
        <h1>{result.channel.name}</h1>
        <p>{result.channel.description}</p>
      </section>
      <section>
        <div className="broadcastStage">
          {result.channel.playback_url ? (
            <LivePlayer
              src={result.channel.playback_url}
              title={`${result.channel.name} live stream`}
              channelName={result.channel.name}
              nowTitle={current?.title}
              nextTitle={next?.title}
            />
          ) : (
            <div className="broadcastStandby">
              <span className="tvLiveBug"><span className="tvLiveDot" /> STANDBY</span>
              <b>CHANNEL STANDBY</b>
              <span>The production HLS feed is not connected to this channel yet. KORA will not claim a live broadcast until a verified feed is attached.</span>
            </div>
          )}
        </div>
        <div className="tvProgrammeBar">
          <div><small>{preview ? 'SCHEDULE PREVIEW' : 'NOW PLAYING'}</small><strong>{current?.title ?? 'No programme currently scheduled'}</strong></div>
          <div><small>UP NEXT</small><strong>{next?.title ?? 'Programming to be announced'}</strong></div>
          <div><small>CHANNEL</small><strong>{result.channel.name}</strong></div>
        </div>
        {current?.sponsor_name ? <div className="panel"><span className="live">SPONSORED</span><p>Presented with {current.sponsor_name}</p></div> : null}
      </section>
      <section>
        <div className="sectionHead"><h2>Next 24 hours</h2><span>South Africa Standard Time</span></div>
        <div className="productionList">
          {result.schedule.length ? result.schedule.map((item) => (
            <div className="productionRow" key={item.id}>
              <strong>{catDateTime(item.starts_at)} • {item.title}</strong>
              <span>{item.is_synthetic ? 'Continuity preview — not a confirmed broadcast' : `${item.is_premiere ? 'Premiere • ' : ''}${item.sponsor_name ? `Sponsored by ${item.sponsor_name}` : 'KORA programming'}`}</span>
            </div>
          )) : <div className="panel"><p>The schedule is being programmed.</p></div>}
        </div>
      </section>
    </main>
  );
}

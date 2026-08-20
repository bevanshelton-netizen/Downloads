import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createScheduleItem, updateChannelStream } from './actions';

export default async function ScheduleAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const now = new Date().toISOString();
  const [{ data: channels }, { data: items }] = await Promise.all([
    supabase.from('live_channels').select('id,name,slug,playback_url,is_active').order('name'),
    supabase.from('schedule_items').select('id,title,starts_at,ends_at,sponsor_name,is_premiere,channel_id').gte('ends_at', now).order('starts_at').limit(50),
  ]);

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA MASTER CONTROL</div><h1>Programme the network.</h1><p>Assign live streams and schedule the electronic programme guide across every KORA channel.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="grid three">
          <form action={createScheduleItem} className="panel formPanel" style={{gridColumn:'span 2'}}>
            <h3>Add programme</h3>
            <label>Channel<select name="channel_id" required><option value="">Choose channel</option>{(channels ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Programme title<input name="title" required /></label>
            <div className="grid two"><label>Starts<input name="starts_at" type="datetime-local" required /></label><label>Ends<input name="ends_at" type="datetime-local" required /></label></div>
            <label>Sponsor<input name="sponsor_name" placeholder="Optional" /></label>
            <label className="checkLine"><input name="is_premiere" type="checkbox" /> Premiere</label>
            <button className="primary">Add to schedule</button>
          </form>
          <div className="panel"><h3>Broadcast standard</h3><p>All programme times are stored in UTC and displayed to viewers in CAT. Overlapping programmes on the same channel are blocked.</p><p>Only staff can change channel stream URLs or schedule items.</p></div>
        </div>

        <div className="panel">
          <h3>Channel streams</h3>
          {(channels ?? []).map(channel => (
            <form action={updateChannelStream} className="productionRow" key={channel.id}>
              <input type="hidden" name="channel_id" value={channel.id} />
              <strong>{channel.name}</strong>
              <div className="inlineForm"><input name="playback_url" defaultValue={channel.playback_url ?? ''} placeholder="https://.../stream.m3u8" /><button className="secondary">Save stream</button></div>
            </form>
          ))}
        </div>

        <div className="panel"><h3>Upcoming schedule</h3>{(items ?? []).length ? (items ?? []).map(item => {
          const channel = (channels ?? []).find(c => c.id === item.channel_id);
          return <div className="productionRow" key={item.id}><strong>{channel?.name ?? 'Channel'} • {item.title}</strong><span>{new Date(item.starts_at).toLocaleString('en-ZA')} → {new Date(item.ends_at).toLocaleTimeString('en-ZA')}{item.is_premiere ? ' • Premiere' : ''}{item.sponsor_name ? ` • ${item.sponsor_name}` : ''}</span></div>;
        }) : <p>No upcoming programmes.</p>}</div>
      </section>
    </main>
  );
}

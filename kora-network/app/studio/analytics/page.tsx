import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function CreatorAnalytics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/analytics');

  const { data: creator } = await supabase.from('creators').select('id').eq('owner_id', user.id).maybeSingle();
  if (!creator) redirect('/creators/apply');

  const { data: rows, error } = await supabase.rpc('get_creator_analytics', { p_days: 30 });
  const analytics = rows ?? [];
  const totals = analytics.reduce((acc: { starts:number; heartbeats:number; engaged:number; sessions:number }, row: any) => ({
    starts: acc.starts + Number(row.starts || 0),
    heartbeats: acc.heartbeats + Number(row.heartbeats || 0),
    engaged: acc.engaged + Number(row.engaged_seconds || 0),
    sessions: acc.sessions + Number(row.distinct_sessions || 0),
  }), { starts:0, heartbeats:0, engaged:0, sessions:0 });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">CREATOR ANALYTICS</div><h1>Understand attention without exposing viewers.</h1><p>KORA gives creators aggregate engagement only. Viewer IDs, child-profile IDs and raw session identifiers are not exposed in Creator Studio.</p><div className="actions"><Link className="secondary" href="/studio">← Studio</Link><Link className="secondary" href="/studio/earnings">Earnings</Link></div></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>Analytics are not available yet.</strong> {error.message}</div> : null}
        <div className="kpis"><div><small>Episode starts • 30d</small><b>{totals.starts.toLocaleString('en-ZA')}</b></div><div><small>Engaged minutes • 30d</small><b>{Math.floor(totals.engaged/60).toLocaleString('en-ZA')}</b></div><div><small>Distinct sessions • 30d</small><b>{totals.sessions.toLocaleString('en-ZA')}</b></div></div>
        <div className="panel"><h3>Production performance</h3><p>“Engaged minutes” measures visible watch-page engagement heartbeats. It is deliberately not labelled exact video watch time until provider/player telemetry verifies playback state.</p>{analytics.length ? analytics.map((row: any) => <div className="productionRow" key={row.production_id}><strong>{row.production_title}</strong><span>{Number(row.starts).toLocaleString('en-ZA')} starts • {Math.floor(Number(row.engaged_seconds)/60).toLocaleString('en-ZA')} engaged min • {Number(row.distinct_sessions).toLocaleString('en-ZA')} sessions</span></div>) : <p>No engagement recorded in the last 30 days.</p>}</div>
      </section>
    </main>
  );
}

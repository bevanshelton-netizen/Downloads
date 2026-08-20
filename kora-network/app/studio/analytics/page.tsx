import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function StudioAnalytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/analytics');
  const { days } = await searchParams;
  const requestedDays = Number(days || 30);
  const range = [7,30,90,365].includes(requestedDays) ? requestedDays : 30;

  const { data, error } = await supabase.rpc('creator_performance_summary', { p_days: range });
  if (error) return <main><section className="subHero"><div className="eyebrow">CREATOR ANALYTICS</div><h1>Analytics unavailable.</h1><p>{error.message}</p></section></main>;

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    views: Number(row.views || 0),
    watch_seconds: Number(row.watch_seconds || 0),
    completions: Number(row.completions || 0),
    creator_revenue: Number(row.creator_revenue || 0),
  }));
  const totals = rows.reduce((sum: any, row: any) => ({
    views: sum.views + row.views,
    watch_seconds: sum.watch_seconds + row.watch_seconds,
    completions: sum.completions + row.completions,
    creator_revenue: sum.creator_revenue + row.creator_revenue,
  }), { views: 0, watch_seconds: 0, completions: 0, creator_revenue: 0 });

  return <main>
    <section className="subHero"><div className="eyebrow">CREATOR ANALYTICS</div><h1>Know what your audience finishes.</h1><p>Aggregated performance for your productions. KORA does not expose individual viewer identities to creators.</p><div className="actions"><Link className="secondary" href="/studio">Studio</Link><Link className="secondary" href="/studio/earnings">Deals & earnings</Link></div></section>
    <section className="dashMain">
      <div className="actions">{[7,30,90,365].map(d => <Link key={d} className={d===range?'primary':'secondary'} href={`/studio/analytics?days=${d}`}>{d} days</Link>)}</div>
      <div className="kpis"><div><small>Views / starts</small><b>{totals.views.toLocaleString('en-ZA')}</b></div><div><small>Watch hours</small><b>{(totals.watch_seconds/3600).toFixed(1)}</b></div><div><small>Creator revenue</small><b>R{totals.creator_revenue.toFixed(2)}</b></div></div>
      <div className="panel"><h3>Production performance</h3>{rows.length ? rows.map((row: any) => {
        const completionRate = row.views > 0 ? row.completions / row.views * 100 : 0;
        return <div className="productionRow" key={row.production_id}><div><strong>{row.production_title}</strong><span>{row.views.toLocaleString('en-ZA')} starts • {(row.watch_seconds/3600).toFixed(1)} watch hours • {completionRate.toFixed(1)}% completion signal</span></div><strong>R{row.creator_revenue.toFixed(2)}</strong></div>;
      }) : <p>No audience activity in this reporting window yet.</p>}</div>
    </section>
  </main>;
}

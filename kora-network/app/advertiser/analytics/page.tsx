import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdvertiserAnalytics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/advertiser/analytics');

  const { data: rows, error } = await supabase.rpc('get_advertiser_campaign_analytics', { p_days: 30 });
  const analytics = rows ?? [];
  const totals = analytics.reduce((acc: { impressions:number; verifiedImpressions:number; clicks:number; completions:number; verifiedCompletions:number }, row: any) => ({
    impressions: acc.impressions + Number(row.impressions || 0),
    verifiedImpressions: acc.verifiedImpressions + Number(row.verified_impressions || 0),
    clicks: acc.clicks + Number(row.clicks || 0),
    completions: acc.completions + Number(row.completions || 0),
    verifiedCompletions: acc.verifiedCompletions + Number(row.verified_completions || 0),
  }), { impressions:0, verifiedImpressions:0, clicks:0, completions:0, verifiedCompletions:0 });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA CAMPAIGN ANALYTICS</div><h1>Measure delivery without receiving viewer identities.</h1><p>Advertisers see aggregate campaign performance. Raw viewer IDs and session identifiers remain inside KORA's controlled data layer.</p><div className="actions"><Link className="secondary" href="/advertiser">← Campaigns</Link><Link className="secondary" href="/advertiser/creatives">Creatives</Link></div></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>Analytics are not available yet.</strong> {error.message}</div> : null}
        <div className="kpis"><div><small>Impressions • 30d</small><b>{totals.impressions.toLocaleString('en-ZA')}</b></div><div><small>Clicks • 30d</small><b>{totals.clicks.toLocaleString('en-ZA')}</b></div><div><small>Verified completions • 30d</small><b>{totals.verifiedCompletions.toLocaleString('en-ZA')}</b></div></div>
        <div className="panel"><h3>Campaign performance</h3>{analytics.length ? analytics.map((row:any) => <div className="productionRow" key={row.campaign_id}><strong>{row.campaign_name}</strong><span>{Number(row.impressions).toLocaleString('en-ZA')} impressions • {Number(row.clicks).toLocaleString('en-ZA')} clicks • {Number(row.completions).toLocaleString('en-ZA')} completion signals • {Number(row.verified_completions).toLocaleString('en-ZA')} verified completions</span></div>) : <p>No campaign delivery recorded in the last 30 days.</p>}</div>
      </section>
    </main>
  );
}

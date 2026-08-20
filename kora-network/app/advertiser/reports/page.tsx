import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdvertiserReports() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: campaigns } = await supabase.from('campaigns')
    .select('id,name,budget,reward_pool,status,starts_at,ends_at')
    .eq('advertiser_id', user.id)
    .order('starts_at', { ascending: false });

  const reports = await Promise.all((campaigns ?? []).map(async campaign => {
    const { data } = await supabase.rpc('advertiser_campaign_summary', { p_campaign_id: campaign.id });
    const summary = Array.isArray(data) ? data[0] : data;
    return { campaign, summary };
  }));

  return <main>
    <section className="subHero"><div className="eyebrow">KORA FOR BRANDS</div><h1>Campaign reporting.</h1><p>See aggregate delivery and verified engagement without receiving viewer identities or household-profile data.</p><div className="actions"><Link className="secondary" href="/advertiser">Campaigns</Link><Link className="secondary" href="/advertiser/creatives">Creatives</Link></div></section>
    <section className="dashMain">
      {reports.length ? reports.map(({campaign,summary}) => {
        const impressions = Number(summary?.impressions || 0);
        const clicks = Number(summary?.clicks || 0);
        const verified = Number(summary?.verified_completions || 0);
        const ctr = impressions > 0 ? clicks / impressions * 100 : 0;
        return <div className="panel" key={campaign.id}>
          <div className="sectionHead"><div><h3>{campaign.name}</h3><p>{campaign.status} • budget R{Number(campaign.budget).toFixed(2)} • planned rewards R{Number(campaign.reward_pool).toFixed(2)}</p></div></div>
          <div className="kpis"><div><small>Deliveries</small><b>{Number(summary?.deliveries || 0).toLocaleString('en-ZA')}</b></div><div><small>Impressions</small><b>{impressions.toLocaleString('en-ZA')}</b></div><div><small>Clicks</small><b>{clicks.toLocaleString('en-ZA')}</b></div></div>
          <div className="kpis"><div><small>CTR</small><b>{ctr.toFixed(2)}%</b></div><div><small>Verified completions</small><b>{verified.toLocaleString('en-ZA')}</b></div><div><small>Viewer rewards paid</small><b>R{Number(summary?.rewards_paid || 0).toFixed(2)}</b></div></div>
        </div>;
      }) : <div className="panel"><p>No campaigns yet. Create a campaign before reporting begins.</p></div>}
    </section>
  </main>;
}

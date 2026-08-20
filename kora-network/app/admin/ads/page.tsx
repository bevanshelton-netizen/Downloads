import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reviewCreative } from './actions';

export default async function AdOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const { data: creatives } = await supabase.from('campaign_creatives')
    .select('id,campaign_id,name,media_url,click_url,duration_seconds,family_safe,status,created_at')
    .in('status',['submitted','approved'])
    .order('created_at');
  const campaignIds = [...new Set((creatives ?? []).map(c => c.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await supabase.from('campaigns').select('id,name,status,advertiser_id').in('id', campaignIds)
    : { data: [] };

  return <main>
    <section className="subHero"><div className="eyebrow">KORA AD OPERATIONS</div><h1>Approve what the audience sees.</h1><p>Campaign funding does not automatically approve a creative. Staff review media and destination links before the delivery engine can serve them.</p></section>
    <section className="dashMain">
      {error ? <div className="panel"><strong>{error}</strong></div> : null}
      <div className="panel"><h3>Creative review queue</h3>{(creatives ?? []).length ? (creatives ?? []).map(creative => {
        const campaign = (campaigns ?? []).find(c => c.id === creative.campaign_id);
        return <form action={reviewCreative} className="moderationItem" key={creative.id}>
          <input type="hidden" name="creative_id" value={creative.id}/>
          <div><strong>{creative.name}</strong><p>{campaign?.name ?? 'Campaign'} • {creative.duration_seconds}s • {creative.family_safe ? 'family-safe declared' : 'general inventory'} • {creative.status}</p><p><a href={creative.media_url} target="_blank" rel="noreferrer">Open media</a>{creative.click_url ? <> • <a href={creative.click_url} target="_blank" rel="noreferrer">Open destination</a></> : null}</p></div>
          <div className="actions"><button className="primary" name="decision" value="approved">Approve</button><button className="secondary" name="decision" value="rejected">Reject</button><button className="secondary" name="decision" value="archived">Archive</button></div>
        </form>;
      }) : <p>No creatives awaiting or holding approval.</p>}</div>
    </section>
  </main>;
}

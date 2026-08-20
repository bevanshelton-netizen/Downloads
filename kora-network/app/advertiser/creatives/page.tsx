import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createCreative, submitCreative } from './actions';

export default async function AdvertiserCreatives({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;

  const { data: campaigns } = await supabase.from('campaigns').select('id,name,status').eq('advertiser_id', user.id).order('created_at', { ascending: false });
  const campaignIds = (campaigns ?? []).map(c => c.id);
  const { data: creatives } = campaignIds.length
    ? await supabase.from('campaign_creatives').select('id,campaign_id,name,media_url,click_url,duration_seconds,family_safe,status,created_at').in('campaign_id', campaignIds).order('created_at', { ascending: false })
    : { data: [] };

  return <main>
    <section className="subHero"><div className="eyebrow">KORA FOR BRANDS</div><h1>Creative library.</h1><p>Submit the actual video or display creative KORA may serve. Every creative is reviewed before it can enter the delivery engine.</p><div className="actions"><Link className="secondary" href="/advertiser">Campaigns</Link><Link className="secondary" href="/advertiser/reports">Reports</Link></div></section>
    <section className="grid three">
      <form action={createCreative} className="panel formPanel" style={{gridColumn:'span 2'}}>
        <h3>New creative</h3>{error ? <p role="alert">{error}</p> : null}
        <label>Campaign<select name="campaign_id" required><option value="">Choose campaign</option>{(campaigns ?? []).map(c => <option value={c.id} key={c.id}>{c.name} • {c.status}</option>)}</select></label>
        <label>Creative name<input name="name" required /></label>
        <label>HTTPS media URL<input name="media_url" type="url" placeholder="https://..." required /></label>
        <label>HTTPS click-through URL<input name="click_url" type="url" placeholder="https://..." /></label>
        <div className="formGrid"><label>Duration seconds<input name="duration_seconds" type="number" min="5" max="180" defaultValue="15" required /></label><label className="checkLine"><input name="family_safe" type="checkbox" defaultChecked /> Declare suitable for family inventory</label></div>
        <button className="primary">Save creative draft</button>
      </form>
      <article className="panel"><h3>Approval gate</h3><p>Drafts are never served. Submit a finished creative for KORA review. Approval does not override the platform-wide pornography and explicit-sexual-content prohibition.</p><p>Kids profiles receive contextual, family-safe inventory only and do not receive cash-reward offers.</p></article>
    </section>
    <section><div className="panel"><h3>Your creatives</h3>{(creatives ?? []).length ? (creatives ?? []).map(creative => {
      const campaign = (campaigns ?? []).find(c => c.id === creative.campaign_id);
      return <div className="productionRow" key={creative.id}><div><strong>{creative.name}</strong><span>{campaign?.name ?? 'Campaign'} • {creative.duration_seconds}s • {creative.family_safe ? 'family-safe declared' : 'general inventory'} • {creative.status}</span></div>{['draft','rejected'].includes(creative.status) ? <form action={submitCreative}><input type="hidden" name="creative_id" value={creative.id}/><button className="secondary">Submit for review</button></form> : null}</div>;
    }) : <p>No creatives yet.</p>}</div></section>
  </main>;
}

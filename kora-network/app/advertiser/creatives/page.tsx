import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitCreative } from './actions';

export default async function AdvertiserCreatives({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/advertiser/creatives');
  const { error, submitted } = await searchParams;

  const { data: campaigns } = await supabase.from('campaigns').select('id,name,status').eq('advertiser_id', user.id).order('created_at', { ascending: false });
  const campaignIds = (campaigns ?? []).map(c => c.id);
  const { data: creatives } = campaignIds.length ? await supabase.from('ad_creatives').select('id,campaign_id,title,media_type,media_url,click_url,duration_seconds,moderation_status,rejection_reason,created_at').in('campaign_id', campaignIds).order('created_at', { ascending: false }) : { data: [] as any[] };
  const campaignById = new Map((campaigns ?? []).map(c => [c.id, c.name]));

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA FOR BRANDS</div><h1>Creative library.</h1><p>Submit campaign media for human review before it can be delivered to viewers. KORA does not serve unmoderated advertiser creatives.</p><div className="actions"><Link className="secondary" href="/advertiser">← Campaigns</Link><Link className="secondary" href="/advertiser/analytics">Campaign analytics</Link></div></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {submitted ? <div className="panel"><strong>Creative submitted.</strong> It will remain unavailable for delivery until a KORA moderator approves it.</div> : null}
        <div className="grid three">
          <form action={submitCreative} className="panel formPanel" style={{gridColumn:'span 2'}}>
            <h3>Submit creative</h3>
            <label>Campaign<select name="campaign_id" required><option value="">Choose campaign</option>{(campaigns ?? []).map(c => <option value={c.id} key={c.id}>{c.name} • {c.status}</option>)}</select></label>
            <label>Creative title<input name="title" required minLength={2} /></label>
            <div className="formGrid"><label>Media type<select name="media_type" defaultValue="video"><option value="video">Video</option><option value="image">Image</option></select></label><label>Video duration seconds<input name="duration_seconds" type="number" min="1" max="300" defaultValue="30" /></label></div>
            <label>HTTPS media URL<input name="media_url" type="url" required placeholder="https://..." /></label>
            <label>HTTPS click destination<input name="click_url" type="url" placeholder="https://..." /></label>
            <button className="primary">Submit for moderation</button>
          </form>
          <article className="panel"><h3>Brand safety</h3><p>Advertising inherits KORA's safety standards. Creatives are reviewed before delivery and KORA Kids does not run this advertising flow.</p></article>
        </div>
        <div className="panel"><h3>Your creatives</h3>{(creatives ?? []).length ? (creatives ?? []).map((item:any) => <div className="productionRow" key={item.id}><strong>{item.title}</strong><span>{campaignById.get(item.campaign_id) ?? 'Campaign'} • {item.media_type} • {item.moderation_status}{item.rejection_reason ? ` • ${item.rejection_reason}` : ''}</span></div>) : <p>No creatives submitted yet.</p>}</div>
      </section>
    </main>
  );
}

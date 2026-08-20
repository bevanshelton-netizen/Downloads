import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reviewAdCreative } from './actions';

export default async function AdModeration({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const admin = createAdminClient();
  const { data: creatives } = await admin.from('ad_creatives').select('id,campaign_id,title,media_type,media_url,click_url,duration_seconds,moderation_status,created_at').in('moderation_status',['pending','approved','paused']).order('created_at');
  const campaignIds = [...new Set((creatives ?? []).map(c => c.campaign_id))];
  const { data: campaigns } = campaignIds.length ? await admin.from('campaigns').select('id,name,advertiser_id,status').in('id', campaignIds) : { data: [] as any[] };
  const campaignById = new Map((campaigns ?? []).map((c:any) => [c.id, c]));

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA AD SAFETY</div><h1>Human review before delivery.</h1><p>Campaign funding does not bypass content standards. KORA moderators approve, reject or pause each advertiser creative before it can be selected for delivery.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel"><h3>Creative review queue</h3>{(creatives ?? []).length ? (creatives ?? []).map((creative:any) => {
          const campaign:any = campaignById.get(creative.campaign_id);
          return <form action={reviewAdCreative} className="moderationItem" key={creative.id}>
            <input type="hidden" name="creative_id" value={creative.id} />
            <div><strong>{creative.title}</strong><p>{campaign?.name ?? 'Campaign'} • {creative.media_type} • {creative.moderation_status}</p><a href={creative.media_url} target="_blank" rel="noreferrer">Open media ↗</a>{creative.click_url ? <> • <a href={creative.click_url} target="_blank" rel="noreferrer">Open destination ↗</a></> : null}</div>
            <label>Moderator note<textarea name="reason" rows={2} placeholder="Required for rejection" /></label>
            <div className="actions"><button className="primary" name="decision" value="approved">Approve</button><button className="secondary" name="decision" value="paused">Pause</button><button className="secondary" name="decision" value="rejected">Reject</button></div>
          </form>;
        }) : <p>No creatives require review.</p>}</div>
      </section>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { confirmCampaignFunding, setCampaignMediaRate } from './actions';

export default async function CampaignOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id,name,budget,reward_pool,reward_per_completion,media_cpm,media_spend,status,starts_at,ends_at,advertiser_id')
    .order('starts_at', { ascending: false });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA COMMERCIAL OPERATIONS</div><h1>Clear money before delivery.</h1><p>Campaigns activate only after cleared revenue is recorded. Media delivery and viewer rewards then consume separate protected portions of the campaign budget.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel">
          <h3>Campaign funding and delivery rates</h3>
          {(campaigns ?? []).length ? (campaigns ?? []).map(campaign => (
            <div className="moderationItem" key={campaign.id}>
              <div><strong>{campaign.name}</strong><p>Budget R{Number(campaign.budget).toFixed(2)} • rewards reserved R{Number(campaign.reward_pool).toFixed(2)} • reward R{Number(campaign.reward_per_completion).toFixed(2)}/verified completion • media spend R{Number(campaign.media_spend || 0).toFixed(2)} • CPM R{Number(campaign.media_cpm || 0).toFixed(2)} • {campaign.status}</p></div>
              <form action={setCampaignMediaRate} className="inlineForm"><input type="hidden" name="campaign_id" value={campaign.id}/><label>Media CPM<input name="media_cpm" type="number" min="0.01" max="10000" step="0.01" defaultValue={Number(campaign.media_cpm || 0) || ''} required /></label><button className="secondary">Save CPM</button></form>
              <form action={confirmCampaignFunding} className="formGrid" style={{gridColumn:'1/-1'}}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <label>Cleared revenue received<input name="gross_amount" type="number" min="0.01" step="0.01" required /></label>
                <label>Fund reward pool now<input name="reward_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <div className="actions"><button className="primary">Confirm cleared funds & activate</button></div>
              </form>
            </div>
          )) : <p>No campaigns.</p>}
        </div>
      </section>
    </main>
  );
}

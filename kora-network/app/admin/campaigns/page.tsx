import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { confirmCampaignFunding, setCampaignDeliveryRules } from './actions';

export default async function CampaignOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id,name,budget,reward_pool,reward_per_completion,status,starts_at,ends_at,advertiser_id,cpm_rate,frequency_cap_per_day')
    .order('starts_at', { ascending: false });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA COMMERCIAL OPERATIONS</div><h1>Clear money before delivery and rewards.</h1><p>Campaigns become active only after cleared campaign revenue is recorded. Operations also controls the delivery CPM and rolling frequency cap used by KORA's ad selector.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel">
          <h3>Campaign funding & delivery rules</h3>
          {(campaigns ?? []).length ? (campaigns ?? []).map(campaign => (
            <div className="moderationItem" key={campaign.id}>
              <div><strong>{campaign.name}</strong><p>Budget R{Number(campaign.budget).toFixed(2)} • rewards R{Number(campaign.reward_pool).toFixed(2)} • R{Number(campaign.reward_per_completion).toFixed(2)}/verified completion • CPM R{Number(campaign.cpm_rate || 0).toFixed(2)} • cap {campaign.frequency_cap_per_day}/24h • {campaign.status}</p></div>
              <form action={setCampaignDeliveryRules} className="formGrid">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <label>Delivery CPM (ZAR)<input name="cpm_rate" type="number" min="0.01" step="0.01" required defaultValue={Number(campaign.cpm_rate || 0) || ''} /></label>
                <label>Impressions per viewer / 24h<input name="frequency_cap_per_day" type="number" min="1" max="50" step="1" required defaultValue={campaign.frequency_cap_per_day || 3} /></label>
                <button className="secondary">Save delivery rules</button>
              </form>
              <form action={confirmCampaignFunding} className="formGrid">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <label>Cleared revenue received<input name="gross_amount" type="number" min="0.01" step="0.01" required /></label>
                <label>Fund reward pool now<input name="reward_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
                <button className="primary">Confirm cleared funds & activate</button>
              </form>
            </div>
          )) : <p>No campaigns.</p>}
        </div>
      </section>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { confirmCampaignFunding } from './actions';

export default async function CampaignOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id,name,budget,reward_pool,reward_per_completion,status,starts_at,ends_at,advertiser_id')
    .order('starts_at', { ascending: false });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA COMMERCIAL OPERATIONS</div><h1>Clear money before rewards.</h1><p>Campaigns become active only after an administrator records cleared campaign revenue. Viewer rewards can never exceed the funded portion of that cleared revenue.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel">
          <h3>Campaign funding queue</h3>
          {(campaigns ?? []).length ? (campaigns ?? []).map(campaign => (
            <form action={confirmCampaignFunding} className="moderationItem" key={campaign.id}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <div><strong>{campaign.name}</strong><p>Budget R{Number(campaign.budget).toFixed(2)} • planned reward allocation R{Number(campaign.reward_pool).toFixed(2)} • R{Number(campaign.reward_per_completion).toFixed(2)} per verified completion • {campaign.status}</p></div>
              <div className="formGrid">
                <label>Cleared revenue received<input name="gross_amount" type="number" min="0.01" step="0.01" required /></label>
                <label>Fund reward pool now<input name="reward_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
              </div>
              <div className="actions"><button className="primary">Confirm cleared funds & activate</button></div>
            </form>
          )) : <p>No campaigns.</p>}
        </div>
      </section>
    </main>
  );
}

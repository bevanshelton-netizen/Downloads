import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createCampaign } from './actions';

export default async function Advertiser({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id,name,budget,reward_pool,reward_per_completion,status,starts_at,ends_at')
    .eq('advertiser_id', user.id)
    .order('starts_at', { ascending: false });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA FOR BRANDS</div><h1>Campaign control room.</h1><p>Plan measurable campaigns, sponsor content and deliberately allocate part of a real paid media budget to verified viewer rewards.</p></section>
      <section className="grid three">
        <form action={createCampaign} className="panel formPanel" style={{ gridColumn: 'span 2' }}>
          <h3>New campaign</h3>
          {error ? <p role="alert">{error}</p> : null}
          <label>Campaign name<input name="name" required /></label>
          <div className="formGrid">
            <label>Total budget (ZAR)<input name="budget" type="number" min="1" step="0.01" required /></label>
            <label>Viewer reward allocation<input name="reward_pool" type="number" min="0" step="0.01" defaultValue="0" /></label>
          </div>
          <label>Reward per verified completed sponsored view<input name="reward_per_completion" type="number" min="0" step="0.01" defaultValue="0" /><small>This amount is not payable until operations confirms cleared campaign funding.</small></label>
          <div className="formGrid">
            <label>Starts<input name="starts_at" type="datetime-local" /></label>
            <label>Ends<input name="ends_at" type="datetime-local" /></label>
          </div>
          <button className="primary" type="submit">Save draft campaign</button>
        </form>
        <article className="panel"><h3>Revenue guardrail</h3><p>A planned reward allocation is not a cash promise. KORA only activates reward credits after campaign money has actually cleared and a funded reward pool has been created.</p></article>
      </section>
      <section>
        <div className="panel"><h3>Your campaigns</h3>{(campaigns ?? []).length ? (campaigns ?? []).map((campaign) => <div className="productionRow" key={campaign.id}><strong>{campaign.name}</strong><span>R{Number(campaign.budget).toFixed(2)} budget • R{Number(campaign.reward_pool).toFixed(2)} rewards • R{Number(campaign.reward_per_completion).toFixed(2)}/verified completion • {campaign.status}</span></div>) : <p>No campaigns yet.</p>}</div>
      </section>
    </main>
  );
}

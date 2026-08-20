import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SubscribeButton from '@/components/SubscribeButton';

export default async function Account({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { payment } = await searchParams;

  const [{ data: profile }, { data: subscriptions }, { data: wallet }, { data: rewardClaims }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('plan_code,status,current_period_end').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('wallets').select('id').eq('owner_id', user.id).maybeSingle(),
    supabase.from('reward_claims').select('id,amount,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

  let balance = 0;
  if (wallet) {
    const { data: entries } = await supabase.from('ledger_entries').select('kind,amount').eq('wallet_id', wallet.id);
    balance = (entries ?? []).reduce((sum, entry) => sum + (entry.kind === 'credit' ? Number(entry.amount) : -Number(entry.amount)), 0);
  }

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">MY KORA</div>
        <h1>Your membership and wallet.</h1>
        <p>Subscriptions fund premium programming while verified reward earnings remain separate and transparent.</p>
        {profile && ['moderator','admin'].includes(profile.role) ? <div className="actions"><Link className="secondary" href="/admin">Open KORA Operations</Link></div> : null}
      </section>
      <section className="grid three">
        <article className="panel"><small>Reward wallet</small><h3>R{balance.toFixed(2)}</h3><p>Rewards are credited only from cleared funded reward pools after sponsored-view verification.</p></article>
        <article className="panel"><h3>KORA Premium</h3><p>Ad-light viewing and premium catalogue access.</p><strong>R79/month</strong><div className="actions"><SubscribeButton planCode="viewer_monthly" label="Choose Premium" /></div></article>
        <article className="panel"><h3>KORA Premium Plus</h3><p>Premium viewing plus priority premieres and expanded benefits.</p><strong>R129/month</strong><div className="actions"><SubscribeButton planCode="viewer_plus" label="Choose Plus" /></div></article>
      </section>
      <section className="grid two">
        <div className="panel">
          <h3>Recent memberships</h3>
          {(subscriptions ?? []).length ? (subscriptions ?? []).map((sub, index) => <div className="productionRow" key={`${sub.plan_code}-${index}`}><strong>{sub.plan_code}</strong><span>{sub.status}{sub.current_period_end ? ` • through ${new Date(sub.current_period_end).toLocaleDateString('en-ZA')}` : ''}</span></div>) : <p>No subscription yet.</p>}
        </div>
        <div className="panel">
          <h3>Verified reward history</h3>
          {(rewardClaims ?? []).length ? (rewardClaims ?? []).map(claim => <div className="productionRow" key={claim.id}><strong>+ R{Number(claim.amount).toFixed(2)}</strong><span>Sponsored viewing • {new Date(claim.created_at).toLocaleString('en-ZA')}</span></div>) : <p>No verified rewards yet.</p>}
        </div>
        {payment ? <div className="panel" style={{gridColumn:'1/-1'}}><strong>Payment status:</strong> {payment}. PayFast confirmation is finalised by the secure server notification.</div> : null}
      </section>
    </main>
  );
}

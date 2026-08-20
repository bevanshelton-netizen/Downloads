import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SubscribeButton from '@/components/SubscribeButton';
import { cancelSubscription } from './actions';

export default async function Account({ searchParams }: { searchParams: Promise<{ payment?: string; message?: string; error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { payment, message, error } = await searchParams;

  const [{ data: profile }, { data: subscriptions }, { data: wallet }, { data: rewardClaims }, { data: creator }, { count: purchaseCount }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('id,plan_code,status,current_period_end,provider_subscription_id,cancelled_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('wallets').select('id').eq('owner_id', user.id).maybeSingle(),
    supabase.from('reward_claims').select('id,amount,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('creators').select('id').eq('owner_id', user.id).maybeSingle(),
    supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'complete'),
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
        <h1>Your membership, library, family and wallet.</h1>
        <p>Subscriptions fund premium programming, paid unlocks stay in your library and verified reward earnings remain separate and transparent.</p>
        <div className="actions"><Link className="secondary" href="/account/library">My Library{purchaseCount ? ` (${purchaseCount})` : ''}</Link><Link className="secondary" href="/family">KORA Family</Link>{creator ? <Link className="secondary" href="/studio/earnings">Creator earnings</Link> : null}{profile && ['moderator','admin'].includes(profile.role) ? <Link className="secondary" href="/admin">KORA Operations</Link> : null}</div>
      </section>
      {message ? <section><div className="panel"><strong>{message}</strong></div></section> : null}
      {error ? <section><div className="panel"><strong>{error}</strong></div></section> : null}
      <section className="grid three">
        <article className="panel"><small>Reward wallet</small><h3>R{balance.toFixed(2)}</h3><p>Rewards are credited only from cleared funded reward pools after sponsored-view verification. Kids profiles cannot earn cash rewards.</p></article>
        <article className="panel"><h3>KORA Premium</h3><p>Ad-light viewing and premium catalogue access.</p><strong>R79/month</strong><div className="actions"><SubscribeButton planCode="viewer_monthly" label="Choose Premium" /></div></article>
        <article className="panel"><h3>KORA Premium Plus</h3><p>Premium viewing plus priority premieres and expanded benefits.</p><strong>R129/month</strong><div className="actions"><SubscribeButton planCode="viewer_plus" label="Choose Plus" /></div></article>
      </section>
      <section className="grid two">
        <div className="panel">
          <h3>Recent memberships</h3>
          {(subscriptions ?? []).length ? (subscriptions ?? []).map((sub) => (
            <div className="productionRow" key={sub.id}>
              <div><strong>{sub.plan_code}</strong><span>{sub.status}{sub.current_period_end ? ` • through ${new Date(sub.current_period_end).toLocaleDateString('en-ZA')}` : ''}{sub.cancelled_at ? ' • renewal cancelled' : ''}</span></div>
              {sub.status === 'active' && sub.provider_subscription_id && !sub.cancelled_at ? <form action={cancelSubscription}><input type="hidden" name="subscription_id" value={sub.id} /><button className="secondary" type="submit">Cancel renewal</button></form> : null}
            </div>
          )) : <p>No subscription yet.</p>}
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

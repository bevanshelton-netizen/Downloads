import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SubscribeButton from '@/components/SubscribeButton';
import { cancelMembership, requestPayout } from './actions';

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; purchase?: string; payout?: string; membership?: string; error?: string; required?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { payment, purchase, payout, membership, error, required } = await searchParams;

  const [
    { data: profile },
    { data: subscriptions },
    { data: wallet },
    { data: rewardClaims },
    { data: purchases },
  ] = await Promise.all([
    supabase.from('profiles').select('role,kyc_status').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('id,plan_code,status,current_period_end,cancel_at_period_end').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('wallets').select('id').eq('owner_id', user.id).maybeSingle(),
    supabase.from('reward_claims').select('id,amount,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('purchases').select('id,production_id,amount,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

  let balance = 0;
  let payoutRequests: Array<{ id: string; amount: number; status: string; requested_at: string }> = [];
  if (wallet) {
    const [{ data: entries }, { data: requests }] = await Promise.all([
      supabase.from('ledger_entries').select('kind,amount').eq('wallet_id', wallet.id),
      supabase.from('payout_requests').select('id,amount,status,requested_at').eq('wallet_id', wallet.id).order('requested_at', { ascending: false }).limit(10),
    ]);
    balance = (entries ?? []).reduce((sum, entry) => sum + (entry.kind === 'credit' ? Number(entry.amount) : -Number(entry.amount)), 0);
    payoutRequests = (requests ?? []).map((item) => ({ ...item, amount: Number(item.amount) }));
  }

  const activeMembership = (subscriptions ?? []).find((sub) => sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) > new Date());

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">MY KORA</div>
        <h1>Your membership and wallet.</h1>
        <p>Memberships, owned premieres, verified rewards and creator earnings stay transparent in one account.</p>
        {profile && ['moderator','admin'].includes(profile.role) ? <div className="actions"><Link className="secondary" href="/admin">Open KORA Operations</Link></div> : null}
      </section>

      {(error || payment || purchase || payout || membership || required) ? <section><div className="panel">
        {error ? <p role="alert"><strong>Action needed:</strong> {error}</p> : null}
        {payment ? <p><strong>Membership payment:</strong> {payment}. PayFast server confirmation determines the final membership state.</p> : null}
        {purchase ? <p><strong>Purchase:</strong> {purchase}. The title unlocks after secure PayFast confirmation.</p> : null}
        {payout ? <p><strong>Payout:</strong> request received and reserved for operations processing.</p> : null}
        {membership === 'cancelling' ? <p><strong>Future renewal cancelled.</strong> Your existing paid access remains available through the current period.</p> : null}
        {required === 'premium' ? <p><strong>Premium membership required</strong> for that title.</p> : null}
      </div></section> : null}

      <section className="grid three">
        <article className="panel"><small>Available wallet</small><h3>R{balance.toFixed(2)}</h3><p>Only funded verified rewards and cleared authorised creator revenue shares can enter the wallet.</p></article>
        <article className="panel"><small>Identity verification</small><h3>{profile?.kyc_status || 'unverified'}</h3><p>KYC must be verified before a cash payout can be requested.</p></article>
        <article className="panel">
          <h3>Request payout</h3><p>Minimum payout R100. A request immediately reserves the amount to prevent double spending.</p>
          <form action={requestPayout} className="formPanel"><label>Amount (ZAR)<input name="amount" type="number" min="100" step="0.01" max={Math.max(0, balance)} required /></label><button className="primary" type="submit" disabled={balance < 100 || profile?.kyc_status !== 'verified'}>Request payout</button></form>
        </article>
      </section>

      <section className="grid two">
        <article className="panel"><h3>KORA Premium</h3><p>Ad-light viewing and premium catalogue access.</p><strong>R79/month</strong><div className="actions">{activeMembership ? <span>Membership active</span> : <SubscribeButton planCode="viewer_monthly" label="Choose Premium" />}</div></article>
        <article className="panel"><h3>KORA Premium Plus</h3><p>Premium viewing plus priority premieres and expanded benefits.</p><strong>R129/month</strong><div className="actions">{activeMembership ? <span>Membership active</span> : <SubscribeButton planCode="viewer_plus" label="Choose Plus" />}</div></article>
      </section>

      {activeMembership ? <section><article className="panel"><h3>Manage membership</h3><p>{activeMembership.plan_code} • paid through {new Date(activeMembership.current_period_end as string).toLocaleDateString('en-ZA')}.</p>{activeMembership.cancel_at_period_end ? <p><strong>Renewal is cancelled.</strong> Access remains active until the paid-through date.</p> : <form action={cancelMembership}><input type="hidden" name="subscription_id" value={activeMembership.id} /><button className="secondary" type="submit">Cancel future renewal</button></form>}</article></section> : null}

      <section className="grid two">
        <div className="panel"><h3>Recent memberships</h3>{(subscriptions ?? []).length ? (subscriptions ?? []).map((sub) => <div className="productionRow" key={sub.id}><strong>{sub.plan_code}</strong><span>{sub.status}{sub.cancel_at_period_end ? ' • renewal cancelled' : ''}{sub.current_period_end ? ` • through ${new Date(sub.current_period_end).toLocaleDateString('en-ZA')}` : ''}</span></div>) : <p>No subscription yet.</p>}</div>
        <div className="panel"><h3>Pay-per-view unlocks</h3>{(purchases ?? []).length ? (purchases ?? []).map((item) => <div className="productionRow" key={item.id}><strong>R{Number(item.amount).toFixed(2)}</strong><span>{item.status} • {new Date(item.created_at).toLocaleDateString('en-ZA')}</span></div>) : <p>No purchases yet.</p>}</div>
        <div className="panel"><h3>Verified reward history</h3>{(rewardClaims ?? []).length ? (rewardClaims ?? []).map((claim) => <div className="productionRow" key={claim.id}><strong>+ R{Number(claim.amount).toFixed(2)}</strong><span>Sponsored viewing • {new Date(claim.created_at).toLocaleString('en-ZA')}</span></div>) : <p>No verified rewards yet.</p>}</div>
        <div className="panel"><h3>Payout requests</h3>{payoutRequests.length ? payoutRequests.map((item) => <div className="productionRow" key={item.id}><strong>R{item.amount.toFixed(2)}</strong><span>{item.status} • {new Date(item.requested_at).toLocaleDateString('en-ZA')}</span></div>) : <p>No payout requests yet.</p>}</div>
      </section>
    </main>
  );
}

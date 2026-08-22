import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { acceptCreatorDeal, requestPayout, submitPayoutOnboarding } from './actions';

export default async function CreatorEarnings({ searchParams }: { searchParams: Promise<{ error?: string; payout?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/earnings');
  const { error, payout } = await searchParams;

  const [{ data: profile }, { data: creator }, { data: wallet }, { data: payoutProfile }] = await Promise.all([
    supabase.from('profiles').select('kyc_status').eq('id', user.id).maybeSingle(),
    supabase.from('creators').select('id,name,verified').eq('owner_id', user.id).maybeSingle(),
    supabase.from('wallets').select('id').eq('owner_id', user.id).maybeSingle(),
    supabase.from('payout_profiles').select('legal_name,country_code,preferred_method,status,account_last4').eq('owner_id', user.id).maybeSingle(),
  ]);

  if (!creator) return <main><section className="subHero"><div className="eyebrow">CREATOR ECONOMY</div><h1>Apply before monetising.</h1><p>KORA creator deals are offered after creator review.</p><Link className="primary" href="/creators/apply">Apply to KORA</Link></section></main>;

  const [{ data: deals }, { data: allocations }, { data: ticketSettlements }] = await Promise.all([
    supabase.from('creator_deals').select('id,deal_name,version,revenue_share_bps,revenue_basis,status,offered_at,accepted_at').eq('creator_id', creator.id).order('offered_at', { ascending: false }),
    supabase.from('creator_revenue_allocations').select('id,eligible_amount,creator_amount,platform_amount,created_at,production_id').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('ticket_settlements').select('id,beneficiary_name,gross_amount,beneficiary_share_bps,beneficiary_amount,platform_amount,status,available_at,created_at').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);

  let balance = 0;
  let requests: Array<{ id: string; amount: number; status: string; requested_at: string }> = [];
  if (wallet) {
    const [{ data: entries }, { data: payoutRequests }] = await Promise.all([
      supabase.from('ledger_entries').select('kind,amount').eq('wallet_id', wallet.id),
      supabase.from('payout_requests').select('id,amount,status,requested_at').eq('wallet_id', wallet.id).order('requested_at', { ascending: false }).limit(20),
    ]);
    balance = (entries ?? []).reduce((sum, entry) => sum + (entry.kind === 'credit' ? Number(entry.amount) : -Number(entry.amount)), 0);
    requests = (payoutRequests ?? []).map(r => ({ ...r, amount: Number(r.amount) }));
  }

  const totalCreatorRevenue = (allocations ?? []).reduce((sum, item) => sum + Number(item.creator_amount), 0);
  const pendingTicketRevenue = (ticketSettlements ?? []).filter(item => item.status === 'pending').reduce((sum, item) => sum + Number(item.beneficiary_amount), 0);
  const releasedTicketRevenue = (ticketSettlements ?? []).filter(item => item.status === 'released').reduce((sum, item) => sum + Number(item.beneficiary_amount), 0);
  const acceptedDeal = (deals ?? []).find(d => d.status === 'accepted');
  const offeredDeals = (deals ?? []).filter(d => d.status === 'offered');
  const payoutReady = profile?.kyc_status === 'verified' && payoutProfile?.status === 'verified';

  return (
    <main>
      <section className="subHero"><div className="eyebrow">CREATOR ECONOMY</div><h1>Your deal. Your tickets. Your payout trail.</h1><p>KORA separates ticket accruals from withdrawable wallet money. Ticket income is shown immediately after cleared payment, held through the event/refund window, then released to your wallet for payout under the normal KYC controls.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {payout ? <div className="panel"><strong>Payout request submitted.</strong> The amount is held from your available wallet while operations processes it.</div> : null}
        <div className="kpis">
          <div><small>Available wallet</small><b>R{balance.toFixed(2)}</b></div>
          <div><small>Ticket income on hold</small><b>R{pendingTicketRevenue.toFixed(2)}</b></div>
          <div><small>Ticket income released</small><b>R{releasedTicketRevenue.toFixed(2)}</b></div>
          <div><small>Creator content revenue credited</small><b>R{totalCreatorRevenue.toFixed(2)}</b></div>
          <div><small>Active content share</small><b>{acceptedDeal ? `${(acceptedDeal.revenue_share_bps / 100).toFixed(1)}%` : 'No deal accepted'}</b></div>
        </div>

        {offeredDeals.map(deal => <form action={acceptCreatorDeal} className="panel" key={deal.id}>
          <input type="hidden" name="deal_id" value={deal.id} />
          <div className="eyebrow">DEAL OFFER</div><h3>{deal.deal_name}</h3>
          <p><strong>{(deal.revenue_share_bps / 100).toFixed(1)}%</strong> creator share of <strong>{deal.revenue_basis.replaceAll('_',' ')}</strong>.</p>
          <p>This does not transfer ownership of your IP. Revenue allocation begins only after you accept this offer and qualifying revenue has cleared.</p>
          <button className="primary">Accept creator deal</button>
        </form>)}

        <div className="panel"><h3>KORA Tickets settlements</h3><p>Ticket splits are event-specific and are frozen on each completed order. A pending settlement is real cleared ticket revenue, but it is not withdrawable until the event/refund hold expires and KORA releases it.</p>{(ticketSettlements ?? []).length ? (ticketSettlements ?? []).map(item => <div className="productionRow" key={item.id}><strong>R{Number(item.beneficiary_amount).toFixed(2)} • {item.status}</strong><span>Gross R{Number(item.gross_amount).toFixed(2)} • your event share {(item.beneficiary_share_bps/100).toFixed(1)}% • KORA R{Number(item.platform_amount).toFixed(2)} • release not before {new Date(item.available_at).toLocaleString('en-ZA')}</span></div>) : <p>No KORA ticket settlements yet.</p>}</div>

        <div className="grid three">
          <form action={submitPayoutOnboarding} className="panel formPanel" style={{ gridColumn: 'span 2' }}>
            <h3>Payout onboarding</h3>
            <p>KORA stores payout status and a provider reference only. Never enter an Internet-banking password, card PIN, CVV or OTP here.</p>
            <div className="formGrid"><label>Legal name<input name="legal_name" required defaultValue={payoutProfile?.legal_name ?? ''} /></label><label>Country code<input name="country_code" maxLength={2} required defaultValue={payoutProfile?.country_code ?? 'ZA'} /></label></div>
            <label>Preferred payout method<select name="preferred_method" defaultValue={payoutProfile?.preferred_method ?? 'bank_eft'}><option value="bank_eft">Bank EFT through approved payout process</option><option value="approved_provider">Approved payout provider</option></select></label>
            <button className="secondary">Submit / update payout onboarding</button>
            <small>KYC: {profile?.kyc_status ?? 'unverified'} • payout profile: {payoutProfile?.status ?? 'not started'}{payoutProfile?.account_last4 ? ` • destination ending ${payoutProfile.account_last4}` : ''}</small>
          </form>
          <form action={requestPayout} className="panel formPanel">
            <h3>Request payout</h3>
            <label>Amount (ZAR)<input name="amount" type="number" min="100" step="0.01" max={Math.max(0, balance)} required /></label>
            <button className="primary" disabled={!payoutReady || balance < 100}>Request payout</button>
            <small>{payoutReady ? 'Identity and payout onboarding verified.' : 'KYC and payout onboarding must both be verified first.'}</small>
          </form>
        </div>

        <div className="grid two">
          <div className="panel"><h3>Content revenue allocations</h3>{(allocations ?? []).length ? (allocations ?? []).map(item => <div className="productionRow" key={item.id}><strong>R{Number(item.creator_amount).toFixed(2)} credited</strong><span>Eligible R{Number(item.eligible_amount).toFixed(2)} • {new Date(item.created_at).toLocaleDateString('en-ZA')}</span></div>) : <p>No creator revenue has been allocated yet.</p>}</div>
          <div className="panel"><h3>Payout history</h3>{requests.length ? requests.map(item => <div className="productionRow" key={item.id}><strong>R{item.amount.toFixed(2)}</strong><span>{item.status} • {new Date(item.requested_at).toLocaleDateString('en-ZA')}</span></div>) : <p>No payout requests yet.</p>}</div>
        </div>
      </section>
    </main>
  );
}

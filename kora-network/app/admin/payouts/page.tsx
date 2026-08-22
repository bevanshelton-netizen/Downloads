import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordConfirmedTicketRefund, releaseTicketSettlement, resolvePayout, verifyPayoutOnboarding } from './actions';

export default async function PayoutOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const admin = createAdminClient();
  const [{ data: payoutProfiles }, { data: requests }, { data: wallets }, { data: settlements, error: settlementError }] = await Promise.all([
    admin.from('payout_profiles').select('owner_id,legal_name,country_code,preferred_method,provider,provider_account_ref,account_last4,status,updated_at').order('updated_at', { ascending: false }).limit(100),
    admin.from('payout_requests').select('id,wallet_id,amount,status,requested_at,processed_at').order('requested_at', { ascending: false }).limit(100),
    admin.from('wallets').select('id,owner_id').limit(500),
    admin.from('ticket_settlements').select('id,owner_id,beneficiary_name,gross_amount,beneficiary_share_bps,beneficiary_amount,platform_amount,currency,status,available_at,created_at,released_at,reversed_at').order('created_at', { ascending: false }).limit(200),
  ]);

  const walletOwner = new Map((wallets ?? []).map(w => [w.id, w.owner_id]));
  const ownerIds = [...new Set([
    ...(payoutProfiles ?? []).map(p => p.owner_id),
    ...(settlements ?? []).flatMap(s => s.owner_id ? [s.owner_id] : []),
    ...(requests ?? []).flatMap(r => walletOwner.get(r.wallet_id) ? [walletOwner.get(r.wallet_id)!] : []),
  ])];
  const { data: profiles } = ownerIds.length ? await admin.from('profiles').select('id,display_name,kyc_status').in('id', ownerIds) : { data: [] as Array<{id:string;display_name:string|null;kyc_status:string}> };
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]));
  const now = Date.now();

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA SETTLEMENT & PAYOUT OPERATIONS</div><h1>Every ticket rand has a trail.</h1><p>Fans pay KORA. Ticket revenue is split into a beneficiary accrual and KORA commission, held through the event/refund window, then released into the artist or promoter wallet. Money can leave KORA only after the existing KYC and payout-verification gates.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {settlementError ? <div className="panel"><strong>Schema 19 must be activated before ticket settlements can be reconciled.</strong></div> : null}

        <div className="panel"><h3>Ticket settlement ledger</h3><p>Default event economics are 90% artist/promoter and 10% KORA. Each settlement permanently stores the split used for that ticket order, so later contract changes do not rewrite history.</p>{(settlements ?? []).length ? (settlements ?? []).map(item => {
          const releasable = item.status === 'pending' && new Date(item.available_at).getTime() <= now;
          return <div className="moderationItem" key={item.id}>
            <div><strong>{item.beneficiary_name} • {item.currency} {Number(item.gross_amount).toFixed(2)} gross</strong><p>Beneficiary {(item.beneficiary_share_bps/100).toFixed(1)}% = {item.currency} {Number(item.beneficiary_amount).toFixed(2)} • KORA = {item.currency} {Number(item.platform_amount).toFixed(2)} • {item.status}</p><p>Created {new Date(item.created_at).toLocaleString('en-ZA')} • release not before {new Date(item.available_at).toLocaleString('en-ZA')}</p></div>
            <div className="actions">
              {item.status === 'pending' ? <form action={releaseTicketSettlement}><input type="hidden" name="settlement_id" value={item.id}/><button className="primary" disabled={!releasable}>{releasable?'Release to beneficiary wallet':'Event/refund hold active'}</button></form> : null}
              {item.status !== 'reversed' ? <form action={recordConfirmedTicketRefund}><input type="hidden" name="settlement_id" value={item.id}/><label><input type="checkbox" name="refund_confirmed" value="yes" required/> External refund confirmed</label><button className="secondary">Record refund reversal</button></form> : null}
            </div>
          </div>;
        }) : <p>No completed ticket sales have created settlements yet.</p>}</div>

        <div className="panel"><h3>Payout onboarding queue</h3>{(payoutProfiles ?? []).length ? (payoutProfiles ?? []).map(item => {
          const owner = profileById.get(item.owner_id);
          return <form action={verifyPayoutOnboarding} className="moderationItem" key={item.owner_id}>
            <input type="hidden" name="owner_id" value={item.owner_id} />
            <div><strong>{item.legal_name}</strong><p>{owner?.display_name || 'KORA user'} • {item.country_code} • {item.preferred_method} • KYC {owner?.kyc_status ?? 'unverified'} • payout {item.status}</p></div>
            <div className="formGrid">
              <label>KYC status<select name="kyc_status" defaultValue={owner?.kyc_status ?? 'unverified'}><option>unverified</option><option>pending</option><option>verified</option><option>rejected</option></select></label>
              <label>Payout status<select name="payout_status" defaultValue={item.status}><option>pending</option><option>verified</option><option>rejected</option><option>suspended</option></select></label>
              <label>Approved provider<input name="provider" defaultValue={item.provider ?? ''} placeholder="Approved provider / bank process" /></label>
              <label>Provider account reference<input name="provider_account_ref" defaultValue={item.provider_account_ref ?? ''} placeholder="Non-secret provider reference" /></label>
              <label>Destination last 4<input name="account_last4" maxLength={4} defaultValue={item.account_last4 ?? ''} placeholder="1234" /></label>
            </div>
            <div className="actions"><button className="primary">Save verification state</button></div>
          </form>;
        }) : <p>No payout profiles are waiting.</p>}</div>

        <div className="panel"><h3>Payout requests</h3>{(requests ?? []).length ? (requests ?? []).map(item => {
          const ownerId = walletOwner.get(item.wallet_id);
          const owner = ownerId ? profileById.get(ownerId) : null;
          return <form action={resolvePayout} className="productionRow" key={item.id}>
            <input type="hidden" name="payout_request_id" value={item.id} />
            <strong>{owner?.display_name || 'Creator'} • R{Number(item.amount).toFixed(2)}</strong>
            <span>{item.status} • requested {new Date(item.requested_at).toLocaleDateString('en-ZA')}</span>
            {item.status === 'pending' ? <div className="actions"><button className="primary" name="decision" value="paid">Mark paid</button><button className="secondary" name="decision" value="rejected">Reject & release hold</button></div> : null}
          </form>;
        }) : <p>No payout requests yet.</p>}</div>
      </section>
    </main>
  );
}

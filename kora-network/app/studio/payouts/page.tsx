import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requestPayout, submitKyc } from './actions';

export default async function Payouts({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;
  const { data: creator } = await supabase.from('creators').select('id,name').eq('owner_id', user.id).maybeSingle();
  if (!creator) redirect('/studio');
  const [{ data: kyc }, { data: wallet }] = await Promise.all([
    supabase.from('creator_kyc').select('*').eq('creator_id', creator.id).maybeSingle(),
    supabase.from('wallets').select('id').eq('owner_id', user.id).maybeSingle(),
  ]);
  let balance = 0;
  let payouts: Array<{ id:string; amount:number; status:string; requested_at:string }> = [];
  if (wallet) {
    const [{ data: entries }, { data: requests }] = await Promise.all([
      supabase.from('ledger_entries').select('kind,amount').eq('wallet_id', wallet.id),
      supabase.from('payout_requests').select('id,amount,status,requested_at').eq('wallet_id', wallet.id).order('requested_at',{ascending:false}).limit(10),
    ]);
    balance = (entries ?? []).reduce((sum,e)=>sum+(e.kind==='credit'?Number(e.amount):-Number(e.amount)),0);
    payouts = (requests ?? []) as typeof payouts;
  }

  return <main>
    <section className="subHero"><div className="eyebrow">CREATOR MONEY</div><h1>KYC, wallet and payouts.</h1><p>KORA pays verified creators from cleared ledger balances. No creator payout is released until identity/business verification is complete.</p></section>
    <section className="grid three">
      <article className="panel"><small>Available ledger balance</small><h3>R{balance.toFixed(2)}</h3><p>KYC status: <strong>{kyc?.status ?? 'not submitted'}</strong></p></article>
      <form action={requestPayout} className="panel formPanel"><h3>Request payout</h3><label>Amount (ZAR)<input name="amount" type="number" min="1" step="0.01" required /></label><button className="primary" disabled={kyc?.status !== 'verified'}>Request payout</button><small>{kyc?.status === 'verified' ? 'Request will enter operations review.' : 'Verification is required first.'}</small></form>
      <article className="panel"><h3>Creator protection</h3><p>Only the last four bank-account digits are stored in this application record. Production payout processing should use a compliant banking/payment provider and operational verification.</p></article>
    </section>
    <section>
      <form action={submitKyc} className="panel formPanel"><h3>Creator verification</h3>{error ? <p role="alert">{error}</p> : null}<div className="formGrid"><label>Legal name<input name="legal_name" defaultValue={kyc?.legal_name ?? ''} required /></label><label>Entity type<select name="entity_type" defaultValue={kyc?.entity_type ?? 'individual'}><option value="individual">Individual</option><option value="sole_proprietor">Sole proprietor</option><option value="company">Company</option><option value="nonprofit">Nonprofit</option><option value="other">Other</option></select></label><label>Country<input name="country_code" maxLength={2} defaultValue={kyc?.country_code ?? 'ZA'} /></label></div><div className="formGrid"><label>ID / identity reference<input name="identity_reference" defaultValue={kyc?.identity_reference ?? ''} /></label><label>Company registration<input name="company_registration" defaultValue={kyc?.company_registration ?? ''} /></label><label>Tax reference<input name="tax_reference" defaultValue={kyc?.tax_reference ?? ''} /></label></div><div className="formGrid"><label>Bank account name<input name="bank_account_name" defaultValue={kyc?.bank_account_name ?? ''} required /></label><label>Bank<input name="bank_name" defaultValue={kyc?.bank_name ?? ''} required /></label><label>Last 4 account digits<input name="bank_account_last4" inputMode="numeric" minLength={4} maxLength={4} defaultValue={kyc?.bank_account_last4 ?? ''} required /></label></div><button className="secondary">Submit for verification</button></form>
    </section>
    <section><div className="panel"><h3>Payout history</h3>{payouts.length ? payouts.map(p=><div className="productionRow" key={p.id}><strong>R{Number(p.amount).toFixed(2)}</strong><span>{p.status} • {new Date(p.requested_at).toLocaleDateString('en-ZA')}</span></div>) : <p>No payout requests yet.</p>}</div></section>
  </main>;
}

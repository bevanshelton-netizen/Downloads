import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePayout, verifyPayoutOnboarding } from './actions';

export default async function PayoutOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const admin = createAdminClient();
  const [{ data: payoutProfiles }, { data: requests }, { data: wallets }] = await Promise.all([
    admin.from('payout_profiles').select('owner_id,legal_name,country_code,preferred_method,provider,provider_account_ref,account_last4,status,updated_at').order('updated_at', { ascending: false }).limit(100),
    admin.from('payout_requests').select('id,wallet_id,amount,status,requested_at,processed_at').order('requested_at', { ascending: false }).limit(100),
    admin.from('wallets').select('id,owner_id').limit(500),
  ]);

  const ownerIds = [...new Set((payoutProfiles ?? []).map(p => p.owner_id))];
  const { data: profiles } = ownerIds.length ? await admin.from('profiles').select('id,display_name,kyc_status').in('id', ownerIds) : { data: [] as Array<{id:string;display_name:string|null;kyc_status:string}> };
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]));
  const walletOwner = new Map((wallets ?? []).map(w => [w.id, w.owner_id]));

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA PAYOUT OPERATIONS</div><h1>Verify before money leaves the platform.</h1><p>KYC and payout-destination verification are separate gates. KORA stores only an approved provider reference and masked destination hint here — never banking passwords, PINs, CVVs or OTPs.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
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

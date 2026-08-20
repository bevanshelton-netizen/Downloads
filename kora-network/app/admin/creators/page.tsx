import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reviewCreatorApplication, reviewCreatorKyc } from './actions';

export default async function CreatorOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const [{ data: applications }, { data: kyc }] = await Promise.all([
    supabase.from('creator_applications').select('id,creator_name,creator_type,city,country_code,portfolio_url,audience_summary,pitch,status,created_at').in('status',['submitted','review','waitlist']).order('created_at'),
    supabase.from('creator_kyc').select('creator_id,legal_name,entity_type,country_code,company_registration,bank_account_name,bank_name,bank_account_last4,status,updated_at').in('status',['submitted','needs_changes']).order('updated_at'),
  ]);

  return <main>
    <section className="subHero"><div className="eyebrow">KORA CREATOR OPERATIONS</div><h1>Recruit, verify, activate.</h1><p>Review creator applications and KYC before money or publishing privileges are expanded.</p></section>
    <section className="dashMain">
      {error ? <div className="panel"><strong>{error}</strong></div> : null}
      <div className="panel"><h3>Creator applications</h3>{(applications ?? []).length ? (applications ?? []).map(a => <form action={reviewCreatorApplication} className="moderationItem" key={a.id}><input type="hidden" name="application_id" value={a.id}/><div><strong>{a.creator_name}</strong><p>{a.creator_type} • {[a.city,a.country_code].filter(Boolean).join(', ')}</p><p>{a.pitch}</p>{a.audience_summary ? <small>{a.audience_summary}</small> : null}{a.portfolio_url ? <p><a href={a.portfolio_url} target="_blank" rel="noreferrer">Open portfolio</a></p> : null}</div><div className="actions"><button className="primary" name="status" value="accepted">Accept</button><button className="secondary" name="status" value="waitlist">Waitlist</button><button className="secondary" name="status" value="declined">Decline</button></div></form>) : <p>No creator applications awaiting review.</p>}</div>
      <div className="panel"><h3>KYC verification queue</h3>{(kyc ?? []).length ? (kyc ?? []).map(k => <form action={reviewCreatorKyc} className="moderationItem" key={k.creator_id}><input type="hidden" name="creator_id" value={k.creator_id}/><div><strong>{k.legal_name}</strong><p>{k.entity_type} • {k.country_code} • {k.bank_name} • account ending {k.bank_account_last4}</p><p>Company registration: {k.company_registration || 'n/a'} • status {k.status}</p></div><div className="actions"><button className="primary" name="status" value="verified">Verify</button><button className="secondary" name="status" value="needs_changes">Needs changes</button><button className="secondary" name="status" value="rejected">Reject</button></div></form>) : <p>No KYC submissions awaiting review.</p>}</div>
    </section>
  </main>;
}

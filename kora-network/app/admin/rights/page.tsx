import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordRightsDispute, resolveRightsDispute } from './actions';

export default async function RightsOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const admin = createAdminClient();
  const [{ data: disputes }, { data: productions }, { data: episodes }] = await Promise.all([
    admin.from('rights_disputes').select('id,production_id,episode_id,claimant_name,claimant_email,rights_basis,evidence_reference,status,created_at').eq('status', 'open').order('created_at'),
    admin.from('productions').select('id,title').order('created_at', { ascending: false }).limit(100),
    admin.from('episodes').select('id,title,production_id').order('created_at', { ascending: false }).limit(200),
  ]);

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA RIGHTS OPERATIONS</div><h1>Rights complaints register.</h1><p>Log incoming copyright or performer-rights complaints, preserve the claimant record and close disputes only after human review.</p></section>
      <section className="grid two">
        <form action={recordRightsDispute} className="panel formPanel">
          <h3>Record a complaint</h3>
          {error ? <p role="alert">{error}</p> : null}
          <label>Claimant name<input name="claimant_name" required maxLength={200} /></label>
          <label>Claimant email<input name="claimant_email" type="email" required maxLength={320} /></label>
          <label>Production<select name="production_id" defaultValue=""><option value="">Select if applicable</option>{(productions ?? []).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <label>Episode<select name="episode_id" defaultValue=""><option value="">Select if applicable</option>{(episodes ?? []).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <label>Rights basis<textarea name="rights_basis" rows={5} required maxLength={4000} /></label>
          <label>Evidence / case reference<textarea name="evidence_reference" rows={3} maxLength={2000} /></label>
          <label className="check"><input type="checkbox" name="good_faith_statement" required /> Claimant supplied a good-faith statement.</label>
          <button className="primary" type="submit">Record complaint</button>
        </form>
        <article className="panel"><h3>Operational rule</h3><p>A rights complaint is not automatically treated as proven. Operations preserves evidence, reviews ownership and licences, communicates with affected parties and may restrict disputed material while the claim is investigated.</p></article>
      </section>
      <section><div className="panel"><h3>Open rights disputes</h3>{(disputes ?? []).length ? (disputes ?? []).map((item) => <form action={resolveRightsDispute} className="moderationItem" key={item.id}><input type="hidden" name="dispute_id" value={item.id} /><div><strong>{item.claimant_name} • {item.claimant_email}</strong><p>{item.rights_basis}</p>{item.evidence_reference ? <small>{item.evidence_reference}</small> : null}</div><div className="actions"><button className="primary" name="resolution" value="resolved">Resolve</button><button className="secondary" name="resolution" value="dismissed">Dismiss</button></div></form>) : <p>No open rights disputes.</p>}</div></section>
    </main>
  );
}

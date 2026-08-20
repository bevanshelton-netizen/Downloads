import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { allocateCreatorRevenue } from './actions';

export default async function RevenueOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const admin = createAdminClient();
  const [{ data: revenues }, { data: productions }, { data: allocations }] = await Promise.all([
    admin.from('revenue_events').select('id,source_type,source_id,gross_amount,currency,cleared_at,created_at').eq('cleared', true).order('created_at', { ascending: false }).limit(50),
    admin.from('productions').select('id,title,creator_id,status').eq('status', 'published').order('title').limit(200),
    admin.from('creator_revenue_allocations').select('id,creator_id,production_id,eligible_amount,creator_amount,platform_amount,created_at').order('created_at', { ascending: false }).limit(50),
  ]);

  const creatorIds = [...new Set((productions ?? []).map(p => p.creator_id))];
  const { data: creators } = creatorIds.length ? await admin.from('creators').select('id,name').in('id', creatorIds) : { data: [] as Array<{id:string;name:string}> };
  const creatorById = new Map((creators ?? []).map(c => [c.id, c.name]));
  const productionById = new Map((productions ?? []).map(p => [p.id, p.title]));

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA REVENUE CONTROL</div><h1>Turn cleared revenue into transparent creator earnings.</h1><p>Operations chooses only the eligible revenue amount and production. The database derives the creator and accepted contractual percentage, caps allocations at cleared revenue and writes the creator wallet credit atomically.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="grid three">
          <form action={allocateCreatorRevenue} className="panel formPanel" style={{gridColumn:'span 2'}}>
            <h3>Allocate eligible revenue</h3>
            <label>Cleared revenue event<select name="revenue_event_id" required><option value="">Choose cleared event</option>{(revenues ?? []).map(r => <option value={r.id} key={r.id}>{r.source_type} • R{Number(r.gross_amount).toFixed(2)} • {new Date(r.cleared_at ?? r.created_at).toLocaleDateString('en-ZA')}</option>)}</select></label>
            <label>Published production<select name="production_id" required><option value="">Choose production</option>{(productions ?? []).map(p => <option value={p.id} key={p.id}>{p.title} — {creatorById.get(p.creator_id) ?? 'Creator'}</option>)}</select></label>
            <label>Eligible amount (ZAR)<input name="eligible_amount" type="number" min="0.01" step="0.01" required /></label>
            <button className="primary">Allocate using accepted creator deal</button>
          </form>
          <article className="panel"><h3>Money guardrails</h3><p>This console cannot invent a creator percentage. It cannot allocate from uncleared revenue, cannot allocate more than the cleared revenue event and cannot allocate the same event to the same production twice.</p></article>
        </div>
        <div className="panel"><h3>Recent allocations</h3>{(allocations ?? []).length ? (allocations ?? []).map(a => <div className="productionRow" key={a.id}><strong>{productionById.get(a.production_id) ?? 'Production'} • R{Number(a.creator_amount).toFixed(2)} creator</strong><span>Eligible R{Number(a.eligible_amount).toFixed(2)} • platform R{Number(a.platform_amount).toFixed(2)} • {new Date(a.created_at).toLocaleDateString('en-ZA')}</span></div>) : <p>No creator revenue allocations yet.</p>}</div>
      </section>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { allocateCreatorEarning } from './actions';

export default async function CreatorEarnings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');
  const { error } = await searchParams;

  const admin = createAdminClient();
  const [creatorsResult, revenueResult, earningsResult, productionsResult] = await Promise.all([
    admin.from('creators').select('id,name').order('name'),
    admin.from('revenue_events').select('id,source_type,source_id,gross_amount,cleared,created_at').eq('cleared', true).order('created_at', { ascending: false }).limit(50),
    admin.from('creator_earnings').select('id,creator_id,revenue_event_id,amount,status,created_at').order('created_at', { ascending: false }).limit(30),
    admin.from('productions').select('id,title,creator_id').order('created_at', { ascending: false }).limit(100),
  ]);

  const creators = creatorsResult.data ?? [];
  const revenue = revenueResult.data ?? [];
  const earnings = earningsResult.data ?? [];
  const productions = productionsResult.data ?? [];
  const creatorNames = new Map(creators.map((item) => [item.id, item.name]));

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA COMMERCIAL OPERATIONS</div>
        <h1>Creator revenue shares.</h1>
        <p>Allocate creator earnings only after revenue has cleared. The database prevents creator allocations plus viewer reward funding from exceeding the underlying cleared revenue event.</p>
      </section>
      <section className="grid two">
        <form action={allocateCreatorEarning} className="panel formPanel">
          <h3>Allocate cleared revenue</h3>
          {error ? <p role="alert">{error}</p> : null}
          <label>Creator
            <select name="creator_id" required defaultValue="">
              <option value="" disabled>Select creator</option>
              {creators.map((creator) => <option value={creator.id} key={creator.id}>{creator.name}</option>)}
            </select>
          </label>
          <label>Cleared revenue event
            <select name="revenue_event_id" required defaultValue="">
              <option value="" disabled>Select cleared revenue</option>
              {revenue.map((item) => <option value={item.id} key={item.id}>{item.source_type} • R{Number(item.gross_amount).toFixed(2)} • {new Date(item.created_at).toLocaleDateString('en-ZA')}</option>)}
            </select>
          </label>
          <label>Production (optional)
            <select name="production_id" defaultValue="">
              <option value="">General creator allocation</option>
              {productions.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label>Creator share (ZAR)<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <button className="primary" type="submit">Allocate to creator wallet</button>
        </form>
        <article className="panel">
          <h3>Control principle</h3>
          <p>Creator earnings are never manufactured balances. They are credited from a specific cleared revenue event, written to the creator earnings register and mirrored into the creator owner’s wallet ledger.</p>
        </article>
      </section>
      <section>
        <div className="panel">
          <h3>Recent creator earnings</h3>
          {earnings.length ? earnings.map((item) => <div className="productionRow" key={item.id}><strong>{creatorNames.get(item.creator_id) || 'Creator'} • R{Number(item.amount).toFixed(2)}</strong><span>{item.status} • {new Date(item.created_at).toLocaleString('en-ZA')}</span></div>) : <p>No creator earnings allocated yet.</p>}
        </div>
      </section>
    </main>
  );
}

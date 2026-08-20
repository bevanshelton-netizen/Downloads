import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

export default async function Studio({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { created } = await searchParams;
  const { data: creator } = await supabase.from('creators').select('id,name,verified,payout_status').eq('owner_id', user.id).maybeSingle();

  let productions: Array<{ id: string; title: string; status: string; age_rating: string | null }> = [];
  if (creator) {
    const result = await supabase.from('productions').select('id,title,status,age_rating').eq('creator_id', creator.id).order('created_at', { ascending: false });
    productions = result.data ?? [];
  }

  const { data: wallet } = await supabase.from('wallets').select('id').eq('owner_id', user.id).maybeSingle();
  let balance = 0;
  if (wallet) {
    const { data: entries } = await supabase.from('ledger_entries').select('kind,amount').eq('wallet_id', wallet.id);
    balance = (entries ?? []).reduce((sum, entry) => sum + (entry.kind === 'credit' ? Number(entry.amount) : -Number(entry.amount)), 0);
  }

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">CREATOR STUDIO</div>
        <h1>Publish. Schedule. Monetise.</h1>
        <p>Protected production console for content, rights, moderation, analytics and earnings.</p>
        <form action={signOut}><button className="secondary">Sign out</button></form>
      </section>
      <section className="dashboard">
        <aside><b>Studio</b><span>Overview</span><span>Content</span><span>Analytics</span><span>Revenue</span><span>Rights</span><span>Payouts</span></aside>
        <div className="dashMain">
          {created ? <div className="panel"><strong>Production created.</strong> It is saved as a draft until you submit it for moderation.</div> : null}
          <div className="kpis">
            <div><small>Productions</small><b>{productions.length}</b></div>
            <div><small>Creator status</small><b>{creator?.verified ? 'Verified' : 'Starter'}</b></div>
            <div><small>Wallet balance</small><b>R{balance.toFixed(2)}</b></div>
          </div>
          <div className="panel">
            <div className="sectionHead"><div><h3>Your productions</h3><p>Draft, submit and publish African stories from one place.</p></div><Link className="primary" href="/studio/productions/new">New production</Link></div>
            {productions.length ? <div className="productionList">{productions.map((p) => <div className="productionRow" key={p.id}><strong>{p.title}</strong><span>{p.age_rating || 'Unrated'} • {p.status}</span></div>)}</div> : <p>No productions yet. Create your first one to start the publishing workflow.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

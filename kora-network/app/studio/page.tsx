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
  let acceptedShare: number | null = null;
  let offeredDeals = 0;
  if (creator) {
    const [productionResult, dealResult] = await Promise.all([
      supabase.from('productions').select('id,title,status,age_rating').eq('creator_id', creator.id).order('created_at', { ascending: false }),
      supabase.from('creator_deals').select('status,revenue_share_bps').eq('creator_id', creator.id),
    ]);
    productions = productionResult.data ?? [];
    const accepted = (dealResult.data ?? []).find(d => d.status === 'accepted');
    acceptedShare = accepted ? Number(accepted.revenue_share_bps) / 100 : null;
    offeredDeals = (dealResult.data ?? []).filter(d => d.status === 'offered').length;
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
        <div className="actions"><Link className="primary" href={creator ? '/studio/earnings' : '/creators/apply'}>{creator ? 'Deals & earnings' : 'Apply to KORA'}</Link><form action={signOut}><button className="secondary">Sign out</button></form></div>
      </section>
      <section className="dashboard">
        <aside><b>Studio</b><span>Overview</span><span>Content</span><Link href="/studio/analytics">Analytics</Link><Link href="/studio/earnings">Revenue & payouts</Link><span>Rights</span></aside>
        <div className="dashMain">
          {created ? <div className="panel"><strong>Production created.</strong> It is saved as a draft until you submit it for moderation.</div> : null}
          {offeredDeals ? <div className="panel"><strong>You have a creator deal waiting.</strong> Review the percentage and revenue basis before accepting it. <Link href="/studio/earnings">Review offer →</Link></div> : null}
          <div className="kpis">
            <div><small>Productions</small><b>{productions.length}</b></div>
            <div><small>Creator deal</small><b>{acceptedShare !== null ? `${acceptedShare.toFixed(1)}%` : creator ? 'Not accepted' : 'Application required'}</b></div>
            <div><small>Wallet balance</small><b>R{balance.toFixed(2)}</b></div>
          </div>
          <div className="panel">
            <div className="sectionHead"><div><h3>Your productions</h3><p>Draft, submit and publish African stories from one place.</p></div>{creator ? <Link className="primary" href="/studio/productions/new">New production</Link> : <Link className="primary" href="/creators/apply">Apply as creator</Link>}</div>
            {productions.length ? <div className="productionList">{productions.map((p) => <Link className="productionRow" key={p.id} href={`/studio/productions/${p.id}`}><strong>{p.title}</strong><span>{p.age_rating || 'Unrated'} • {p.status}</span></Link>)}</div> : <p>{creator ? 'No productions yet. Create your first one to start the publishing workflow.' : 'Apply to KORA before creating a production.'}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

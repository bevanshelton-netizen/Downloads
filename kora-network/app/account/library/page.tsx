import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MyLibrary() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account/library');

  const { data: purchases } = await supabase.from('purchases')
    .select('id,production_id,amount,currency,created_at')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .not('production_id', 'is', null)
    .order('created_at', { ascending: false });

  const productionIds = [...new Set((purchases ?? []).map(item => item.production_id).filter(Boolean))] as string[];
  const { data: productions } = productionIds.length
    ? await supabase.from('productions').select('id,title,slug,synopsis,age_rating,poster_url,status').in('id', productionIds)
    : { data: [] };

  return <main>
    <section className="subHero"><div className="eyebrow">MY KORA LIBRARY</div><h1>Your paid unlocks.</h1><p>Completed pay-per-view purchases remain tied to your KORA account and can be reopened from here.</p><Link className="secondary" href="/account">← My KORA</Link></section>
    <section>
      <div className="panel"><h3>Purchased programmes</h3>{(purchases ?? []).length ? (purchases ?? []).map(purchase => {
        const production = (productions ?? []).find(item => item.id === purchase.production_id);
        if (!production) return null;
        return <div className="productionRow" key={purchase.id}><div><strong>{production.title}</strong><span>{production.age_rating || 'Unrated'} • purchased {new Date(purchase.created_at).toLocaleDateString('en-ZA')} • R{Number(purchase.amount).toFixed(2)}</span></div><Link className="secondary" href={`/watch/${production.slug}`}>Watch</Link></div>;
      }) : <p>No pay-per-view titles in your library yet.</p>}</div>
    </section>
  </main>;
}

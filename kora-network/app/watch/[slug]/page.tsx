import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createSignedPlaybackUrl } from '@/lib/video';
import PurchaseButton from '@/components/PurchaseButton';

export default async function WatchShow({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ episode?: string }>;
}) {
  const { slug } = await params;
  const { episode: requestedEpisode } = await searchParams;
  const supabase = await createClient();

  const { data: production } = await supabase
    .from('productions')
    .select('id,title,slug,synopsis,genre,primary_language,age_rating,access_mode,purchase_price')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!production) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (production.access_mode === 'premium') {
    if (!user) redirect('/login');
    const { data: membership } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (!membership) redirect('/account?required=premium');
  }

  if (production.access_mode === 'pay_per_view') {
    if (!user) redirect('/login');
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('production_id', production.id)
      .eq('status', 'complete')
      .limit(1)
      .maybeSingle();
    if (!purchase) {
      const price = Number(production.purchase_price || 0);
      return (
        <main>
          <section className="subHero">
            <div className="eyebrow">PREMIUM PREMIERE</div>
            <h1>{production.title}</h1>
            <p>Unlock this title once and keep access on your KORA account.</p>
            <div className="actions">
              <PurchaseButton productionId={production.id} label={`Unlock for R${price.toFixed(2)}`} />
              <Link className="secondary" href="/watch">← Back to catalogue</Link>
            </div>
          </section>
        </main>
      );
    }
  }

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id,episode_number,title,playback_id,duration_seconds')
    .eq('production_id', production.id)
    .eq('status', 'published')
    .order('episode_number');
  const selected = (episodes ?? []).find((item) => item.id === requestedEpisode) ?? episodes?.[0];
  const playbackUrl = selected?.playback_id ? await createSignedPlaybackUrl(selected.playback_id).catch(() => null) : null;

  return (
    <main>
      <section className="watchHero">
        <div className="eyebrow">{production.access_mode.replace('_', ' ').toUpperCase()} • {production.age_rating || 'UNRATED'}</div>
        <h1>{production.title}</h1>
        <p>{production.synopsis}</p>
      </section>
      <section className="watchLayout">
        <div className="playerShell">
          {playbackUrl ? <iframe src={playbackUrl} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={selected?.title || production.title} /> : <div className="playerPlaceholder"><strong>{selected ? 'Video is processing or playback credentials are not active yet.' : 'No published episodes yet.'}</strong></div>}
        </div>
        <aside className="episodeRail">
          <h3>Episodes</h3>
          {(episodes ?? []).map((item) => <Link className={`episodeLink ${item.id === selected?.id ? 'active' : ''}`} href={`/watch/${slug}?episode=${item.id}`} key={item.id}><strong>{item.episode_number}. {item.title}</strong><span>{Math.ceil(Number(item.duration_seconds || 0) / 60)} min</span></Link>)}
        </aside>
      </section>
    </main>
  );
}

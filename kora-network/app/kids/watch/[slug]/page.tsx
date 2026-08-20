import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createSignedPlaybackUrl } from '@/lib/video';
import { exitChildMode } from '@/app/family/actions';

const ratingRank: Record<string, number> = { A: 0, PG: 1, '13': 2, '16': 3, '18': 4 };

export default async function KidsWatch({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ episode?: string; exit_error?: string }> }) {
  const { slug } = await params;
  const { episode: requestedEpisode, exit_error: exitError } = await searchParams;
  const jar = await cookies();
  const activeProfileId = jar.get('kora_child_profile')?.value;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let activeProfile: { id: string; nickname: string; max_age_rating: string } | null = null;
  if (activeProfileId && user) {
    const result = await supabase.from('viewer_profiles').select('id,nickname,max_age_rating').eq('id', activeProfileId).eq('owner_id', user.id).eq('profile_kind','child').maybeSingle();
    activeProfile = result.data;
  }

  const { data: production } = await supabase.from('productions')
    .select('id,title,slug,synopsis,genre,primary_language,age_rating,access_mode')
    .eq('slug', slug)
    .eq('status','published')
    .eq('kids_approved', true)
    .neq('access_mode','pay_per_view')
    .maybeSingle();
  if (!production) notFound();
  if (activeProfile && (ratingRank[production.age_rating || '18'] ?? 99) > (ratingRank[activeProfile.max_age_rating] ?? -1)) notFound();

  if (production.access_mode === 'premium') {
    if (!user) return <main className="kidsMode"><section className="subHero"><h1>{production.title}</h1><p>This Kids title is part of KORA Premium. A parent or account holder must activate a membership.</p><Link className="secondary" href="/login?next=/kids">Parent sign in</Link></section></main>;
    const { data: membership } = await supabase.from('subscriptions').select('id').eq('user_id', user.id).eq('status','active').gt('current_period_end', new Date().toISOString()).limit(1).maybeSingle();
    if (!membership) return <main className="kidsMode"><section className="subHero"><h1>{production.title}</h1><p>This title needs KORA Premium. Kids Mode never opens a purchase flow.</p>{activeProfile ? <form action={exitChildMode} className="inlineForm"><input name="family_pin" type="password" inputMode="numeric" placeholder="Parent PIN" required minLength={4} maxLength={6} /><button className="secondary">Parent exit</button></form> : <Link className="secondary" href="/account">Parent membership</Link>}{exitError ? <p role="alert">{exitError}</p> : null}</section></main>;
  }

  const { data: episodes } = await supabase.from('episodes').select('id,episode_number,title,playback_id,duration_seconds').eq('production_id', production.id).eq('status','published').order('episode_number');
  const selected = (episodes ?? []).find(item => item.id === requestedEpisode) ?? episodes?.[0];
  const playbackUrl = selected?.playback_id ? await createSignedPlaybackUrl(selected.playback_id).catch(() => null) : null;

  return (
    <main className="kidsMode">
      <section className="watchHero"><div className="eyebrow">KORA KIDS • {production.age_rating}</div><h1>{production.title}</h1><p>{production.synopsis}</p><Link href="/kids">← KORA Kids</Link></section>
      <section className="watchLayout">
        <div className="playerShell">{playbackUrl ? <iframe src={playbackUrl} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={selected?.title || production.title} /> : <div className="playerPlaceholder"><strong>{selected ? 'Video is processing or playback is not active yet.' : 'No published episodes yet.'}</strong></div>}</div>
        <aside className="episodeRail"><h3>Episodes</h3>{(episodes ?? []).map(item => <Link className={`episodeLink ${item.id === selected?.id ? 'active' : ''}`} href={`/kids/watch/${slug}?episode=${item.id}`} key={item.id}><strong>{item.episode_number}. {item.title}</strong><span>{Math.ceil(Number(item.duration_seconds || 0) / 60)} min</span></Link>)}</aside>
      </section>
    </main>
  );
}

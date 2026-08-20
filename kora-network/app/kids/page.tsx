import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { exitChildMode } from '@/app/family/actions';

export default async function Kids({ searchParams }: { searchParams: Promise<{ exit_error?: string }> }) {
  const { exit_error: exitError } = await searchParams;
  const jar = await cookies();
  const activeProfileId = jar.get('kora_child_profile')?.value;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let activeProfile: { id: string; nickname: string; age_band: string; max_age_rating: string } | null = null;
  if (activeProfileId && user) {
    const result = await supabase.from('viewer_profiles').select('id,nickname,age_band,max_age_rating').eq('id', activeProfileId).eq('owner_id', user.id).eq('profile_kind','child').maybeSingle();
    activeProfile = result.data;
  }

  const allowedRatings = activeProfile?.max_age_rating === 'A' ? ['A']
    : activeProfile?.max_age_rating === 'PG' ? ['A','PG']
    : activeProfile?.max_age_rating === '13' ? ['A','PG','13']
    : activeProfile?.max_age_rating === '16' ? ['A','PG','13','16']
    : ['A','PG'];

  const { data: productions } = await supabase.from('productions')
    .select('id,title,slug,synopsis,genre,primary_language,age_rating,access_mode')
    .eq('status','published')
    .eq('kids_approved', true)
    .in('age_rating', allowedRatings)
    .neq('access_mode','pay_per_view')
    .order('created_at', { ascending: false })
    .limit(40);

  return (
    <main className="kidsMode">
      <section className="subHero">
        <div className="eyebrow">KORA KIDS • CURATED & MODERATED</div>
        <h1>{activeProfile ? `Hi ${activeProfile.nickname}!` : 'Stories young Africans can grow up with.'}</h1>
        <p>{activeProfile ? `Locked Kids Mode • ${activeProfile.age_band.replace('_','–')} • content up to ${activeProfile.max_age_rating}. No purchases, viewer cash rewards or personalised advertising are available in this profile.` : 'This catalogue shows only productions separately approved by KORA moderators for Kids. Parent-managed locked mode is available through KORA Family.'}</p>
        {activeProfile ? <form action={exitChildMode} className="inlineForm"><input name="family_pin" type="password" inputMode="numeric" placeholder="Parent PIN to exit" minLength={4} maxLength={6} required /><button className="secondary">Exit Kids Mode</button></form> : <Link className="secondary" href={user ? '/family' : '/login?next=/family'}>Set up Kids Mode</Link>}
        {exitError ? <p role="alert"><strong>{exitError}</strong></p> : null}
      </section>
      <section>
        <div className="sectionHead"><h2>KORA Kids</h2><span>Human-approved titles only</span></div>
        <div className="grid three">{(productions ?? []).length ? (productions ?? []).map((item, index) => <Link className={`card poster p${index % 4}`} href={`/kids/watch/${item.slug}`} key={item.id}><span className="badge">{item.age_rating} • KIDS APPROVED</span><div className="cardBottom"><small>{item.genre || 'Family'} • {item.primary_language || 'Multilingual'}</small><h3>{item.title}</h3><p>{item.synopsis}</p></div></Link>) : <article className="panel" style={{gridColumn:'1/-1'}}><h3>Kids catalogue is being curated.</h3><p>Titles will appear here only after publication and a separate KORA Kids approval. We deliberately do not fill this area with unreviewed general catalogue content.</p></article>}</div>
      </section>
    </main>
  );
}

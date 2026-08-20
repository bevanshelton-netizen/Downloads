import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Watch() {
  const supabase = await createClient();
  const { data: productions } = await supabase
    .from('productions')
    .select('id,title,slug,synopsis,genre,primary_language,age_rating,access_mode')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  return (
    <main>
      <section className="subHero"><div className="eyebrow">ON DEMAND</div><h1>Watch African stories.</h1><p>Published KORA films, series and creator originals. Every title has passed platform moderation.</p></section>
      <section>
        {(productions ?? []).length ? <div className="grid">{(productions ?? []).map((show) => (
          <Link className="card" href={`/watch/${show.slug}`} key={show.id}>
            <div className="poster"><span className="badge">{show.access_mode.replace('_', ' ').toUpperCase()}</span><div className="cardBottom"><small>{show.genre || 'KORA'}</small><h3>{show.title}</h3><p>{show.synopsis || `${show.primary_language || 'African'} entertainment`}</p><small>{show.age_rating || 'Unrated'}</small></div></div>
          </Link>
        ))}</div> : <div className="panel"><h3>The first catalogue is being prepared.</h3><p>Approved creator productions will appear here automatically.</p></div>}
      </section>
    </main>
  );
}

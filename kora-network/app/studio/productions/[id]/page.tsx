import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UploadEpisode from '@/components/UploadEpisode';
import { addEpisode, submitForReview } from './actions';

export default async function ProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: production } = await supabase
    .from('productions')
    .select('id,title,synopsis,status,age_rating,creator_id')
    .eq('id', id)
    .maybeSingle();
  if (!production) notFound();

  const { data: creator } = await supabase.from('creators').select('owner_id').eq('id', production.creator_id).maybeSingle();
  if (!creator || creator.owner_id !== user.id) notFound();

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id,episode_number,title,status,playback_id')
    .eq('production_id', id)
    .order('episode_number');

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">CREATOR STUDIO • {production.status.toUpperCase()}</div>
        <h1>{production.title}</h1>
        <p>{production.synopsis || 'Build your series episode by episode, then submit it to KORA moderation.'}</p>
        <Link className="secondary" href="/studio">← Studio</Link>
      </section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel">
          <h3>Episodes</h3>
          <div className="productionList">
            {(episodes ?? []).map((episode) => (
              <div className="episodeRow" key={episode.id}>
                <div><strong>{episode.episode_number}. {episode.title}</strong><span>{episode.status}</span></div>
                <UploadEpisode episodeId={episode.id} hasVideo={Boolean(episode.playback_id)} />
              </div>
            ))}
          </div>
        </div>
        {production.status === 'draft' ? (
          <div className="grid three">
            <form action={addEpisode} className="panel formPanel" style={{ gridColumn: 'span 2' }}>
              <h3>Add episode</h3>
              <input type="hidden" name="production_id" value={production.id} />
              <div className="formGrid">
                <label>Episode number<input name="episode_number" type="number" min={1} required /></label>
                <label>Title<input name="title" required /></label>
              </div>
              <button className="primary" type="submit">Add episode</button>
            </form>
            <form action={submitForReview} className="panel formPanel">
              <h3>Ready?</h3>
              <p>Every episode needs a video. Submission moves the production into human moderation before publication.</p>
              <input type="hidden" name="production_id" value={production.id} />
              <button className="primary" type="submit">Submit for review</button>
            </form>
          </div>
        ) : (
          <div className="panel"><h3>Moderation status</h3><p>This production is currently <strong>{production.status}</strong>.</p></div>
        )}
      </section>
    </main>
  );
}

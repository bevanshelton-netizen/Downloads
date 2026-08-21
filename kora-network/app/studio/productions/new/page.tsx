import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';
import { allMusicGenres } from '@/lib/music-genres';
import { createProduction } from './actions';

export default async function NewProduction({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/productions/new');
  const { error } = await searchParams;

  const { data: creator } = await supabase.from('creators').select('id').eq('owner_id', user.id).maybeSingle();
  if (!creator) redirect('/creators/apply?error=KORA%20creator%20approval%20is%20required%20before%20starting%20a%20production');

  const { data: acceptance } = await supabase.from('agreement_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('document_code', legal.creatorAgreement.code)
    .eq('document_version', legal.creatorAgreement.version)
    .maybeSingle();
  if (!acceptance) redirect('/legal/creator-agreement/accept');

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">CREATOR STUDIO</div>
        <h1>Start a new production.</h1>
        <p>Create the catalogue, monetisation and rights record first. Video upload and moderation attach to this production next.</p>
      </section>
      <section>
        <form action={createProduction} className="panel formPanel">
          {error ? <p role="alert">{error}</p> : null}
          <label>Title<input name="title" required minLength={2} /></label>
          <label>Synopsis<textarea name="synopsis" rows={5} /></label>
          <div className="formGrid">
            <label>Genre<input name="genre" list="kora-genre-options" placeholder="Drama, Amapiano, Gospel, documentary…" /></label>
            <label>Primary language<input name="primary_language" placeholder="English, isiZulu, isiXhosa…" /></label>
            <label>Proposed age rating<select name="age_rating" defaultValue="PG"><option>A</option><option>PG</option><option>13</option><option>16</option><option>18</option></select></label>
          </div>
          <datalist id="kora-genre-options">
            {allMusicGenres.map((genre) => <option value={genre} key={genre} />)}
          </datalist>
          <p>Music creators can choose a KORA genre suggestion or type an emerging, regional or hybrid sound in their own words.</p>
          <h3>Monetisation</h3>
          <div className="formGrid">
            <label>Access model<select name="access_mode" defaultValue="ad_supported"><option value="ad_supported">Free with approved advertising</option><option value="free">Free</option><option value="premium">KORA Premium members</option><option value="pay_per_view">One-time paid unlock</option></select></label>
            <label>Pay-per-view price (ZAR)<input name="purchase_price" type="number" min="1" step="0.01" placeholder="Required only for paid unlock" /></label>
          </div>
          <p>For paid unlocks, KORA reads the price from the server-side production record. A browser cannot choose its own checkout amount.</p>
          <h3>Rights declaration</h3>
          <p>You accepted Creator Agreement version {legal.creatorAgreement.version}. These declarations are stored against this production.</p>
          <label className="check"><input type="checkbox" name="rights_confirmed" required /> I own or control the rights required to publish and monetise this production.</label>
          <label className="check"><input type="checkbox" name="contributors_confirmed" required /> I have the necessary performer, contributor and location permissions.</label>
          <label className="check"><input type="checkbox" name="music_confirmed" required /> I control or have licensed all music/composition and recording rights used in this production.</label>
          <label className="check"><input type="checkbox" name="likeness_confirmed" required /> I have the necessary permissions for identifiable people's likenesses and participation.</label>
          <label className="check"><input type="checkbox" name="policy_confirmed" required /> This production complies with KORA's content policy, including the prohibition on pornography and explicit sexual content.</label>
          <p><Link href="/legal/creator-agreement">Creator Agreement</Link> • <Link href="/legal/copyright">Rights complaint process</Link></p>
          <button className="primary" type="submit">Create production & rights record</button>
        </form>
      </section>
    </main>
  );
}

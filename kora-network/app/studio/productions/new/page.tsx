import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createProduction } from './actions';

export default async function NewProduction({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">CREATOR STUDIO</div>
        <h1>Start a new production.</h1>
        <p>Create the catalogue record first. Video upload and moderation attach to this production next.</p>
      </section>
      <section>
        <form action={createProduction} className="panel formPanel">
          {error ? <p role="alert">{error}</p> : null}
          <label>Title<input name="title" required minLength={2} /></label>
          <label>Synopsis<textarea name="synopsis" rows={5} /></label>
          <div className="formGrid">
            <label>Genre<input name="genre" placeholder="Drama, documentary, comedy…" /></label>
            <label>Primary language<input name="primary_language" placeholder="English, isiZulu, isiXhosa…" /></label>
            <label>Age rating<select name="age_rating" defaultValue="PG"><option>A</option><option>PG</option><option>13</option><option>16</option><option>18</option></select></label>
          </div>
          <label className="check"><input type="checkbox" name="rights_confirmed" required /> I own or control the rights required to publish this production.</label>
          <label className="check"><input type="checkbox" name="policy_confirmed" required /> This production complies with KORA's content policy, including the prohibition on pornography and explicit sexual content.</label>
          <button className="primary" type="submit">Create production</button>
        </form>
      </section>
    </main>
  );
}

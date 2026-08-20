import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { submitCreatorApplication } from './actions';

export default async function CreatorApply({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string; status?: string }> }) {
  const { error, submitted, status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let application: { display_name: string; country_code: string; creator_type: string; languages: string[]; portfolio_url: string | null; pitch: string | null; status: string } | null = null;
  if (user) {
    const result = await supabase.from('creator_applications')
      .select('display_name,country_code,creator_type,languages,portfolio_url,pitch,status')
      .eq('user_id', user.id)
      .maybeSingle();
    application = result.data;
  }

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">JOIN THE KORA CREATOR NETWORK</div>
        <h1>Your story can become television.</h1>
        <p>We are building a pipeline for African filmmakers, producers, writers, performers and independent studios. You keep your IP by default and see your deal before you accept it.</p>
      </section>
      <section className="grid three">
        <article className="panel"><h3>1. Apply</h3><p>Tell us what you make, where you create and show us a portfolio if you have one.</p></article>
        <article className="panel"><h3>2. Get reviewed</h3><p>KORA reviews quality, rights readiness, audience fit and compliance with the family-safe content policy.</p></article>
        <article className="panel"><h3>3. Get your deal</h3><p>Accepted creators receive a transparent revenue-share offer in Creator Studio before monetisation begins.</p></article>
      </section>
      <section>
        {!user ? (
          <div className="panel">
            <h3>Start your creator application</h3>
            <p>Create or sign in to your KORA account first. You will return directly to this application.</p>
            <Link className="primary" href="/login?next=/creators/apply">Sign in & apply</Link>
          </div>
        ) : application?.status === 'accepted' ? (
          <div className="panel"><h3>You are accepted.</h3><p>Your Creator Studio is ready. Review any offered creator deal before publishing monetised content.</p><Link className="primary" href="/studio">Open Creator Studio</Link></div>
        ) : (
          <form action={submitCreatorApplication} className="panel formPanel">
            <h3>Creator application</h3>
            {submitted ? <p role="status"><strong>Application submitted.</strong> KORA can now review it from the operations queue.</p> : null}
            {status ? <p role="status">Current application status: <strong>{status}</strong>.</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            <div className="formGrid">
              <label>Creator / studio name<input name="display_name" required minLength={2} defaultValue={application?.display_name ?? ''} /></label>
              <label>Country code<input name="country_code" required maxLength={2} defaultValue={application?.country_code ?? 'ZA'} /></label>
            </div>
            <label>Creator type<select name="creator_type" required defaultValue={application?.creator_type ?? ''}><option value="">Choose one</option><option value="filmmaker">Filmmaker / director</option><option value="producer">Producer</option><option value="writer">Writer / show creator</option><option value="actor_creator">Actor-creator</option><option value="comedian">Comedian</option><option value="musician">Musician / performance creator</option><option value="documentarian">Documentary creator</option><option value="studio">Independent studio</option><option value="other">Other creator</option></select></label>
            <label>Languages<input name="languages" placeholder="English, isiZulu, isiXhosa" defaultValue={application?.languages?.join(', ') ?? ''} /></label>
            <label>Portfolio / channel link<input name="portfolio_url" type="url" placeholder="https://..." defaultValue={application?.portfolio_url ?? ''} /></label>
            <label>Your pitch<textarea name="pitch" rows={7} required minLength={40} placeholder="What stories do you want to make for African audiences? What have you produced already?">{application?.pitch ?? ''}</textarea></label>
            <small>Do not submit banking passwords, card details, identity-document images or other unnecessary sensitive information here.</small>
            <button className="primary">Submit creator application</button>
          </form>
        )}
      </section>
    </main>
  );
}

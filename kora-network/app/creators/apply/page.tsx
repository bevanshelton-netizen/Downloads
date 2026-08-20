import { submitCreatorApplication } from './actions';

export default async function CreatorApply({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string }> }) {
  const { error, submitted } = await searchParams;
  return <main>
    <section className="subHero"><div className="eyebrow">JOIN KORA</div><h1>Bring Africa your next story.</h1><p>Filmmakers, actors, writers, comedians, musicians, churches, studios and independent creators can apply to publish, earn and grow through KORA.</p></section>
    <section>
      <form action={submitCreatorApplication} className="panel formPanel">
        {submitted ? <p><strong>Application received.</strong> KORA operations can now review your creator profile.</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="formGrid"><label>Creator / studio name<input name="creator_name" required /></label><label>Creator type<select name="creator_type" required defaultValue="filmmaker"><option value="filmmaker">Filmmaker / producer</option><option value="writer">Writer</option><option value="actor">Actor / performance creator</option><option value="music">Music creator</option><option value="comedy">Comedy</option><option value="faith">Faith / community</option><option value="studio">Production studio</option><option value="other">Other</option></select></label></div>
        <div className="formGrid"><label>City<input name="city" /></label><label>Country code<input name="country_code" defaultValue="ZA" maxLength={2} /></label></div>
        <label>Portfolio / social link<input name="portfolio_url" type="url" placeholder="https://" /></label>
        <label>Existing audience<input name="audience_summary" placeholder="e.g. 25k TikTok followers, community theatre audience" /></label>
        <label>Your pitch<textarea name="pitch" rows={7} minLength={30} required placeholder="Tell us what you make, who it is for and what you want to bring to KORA." /></label>
        <button className="primary">Submit creator application</button>
      </form>
    </section>
  </main>;
}

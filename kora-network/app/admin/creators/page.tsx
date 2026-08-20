import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reviewCreatorApplication } from './actions';

export default async function CreatorOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const { data: applications } = await supabase.from('creator_applications')
    .select('id,display_name,country_code,creator_type,languages,portfolio_url,pitch,status,created_at')
    .in('status', ['submitted','reviewing','waitlisted'])
    .order('created_at');

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA CREATOR ACQUISITION</div><h1>Find the next African hit.</h1><p>Review applicants, move promising creators through the pipeline and issue a transparent revenue-share offer. The creator must accept the deal before revenue can be allocated.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel"><h3>Creator applications</h3>{(applications ?? []).length ? (applications ?? []).map(app => (
          <form action={reviewCreatorApplication} className="moderationItem" key={app.id}>
            <input type="hidden" name="application_id" value={app.id} />
            <div>
              <strong>{app.display_name}</strong>
              <p>{app.creator_type} • {app.country_code} • {(app.languages ?? []).join(', ') || 'Languages not listed'} • {app.status}</p>
              <p>{app.pitch || 'No pitch supplied'}</p>
              {app.portfolio_url ? <a href={app.portfolio_url} target="_blank" rel="noreferrer">Open portfolio ↗</a> : null}
            </div>
            <div>
              <label>Creator share of eligible net content revenue (%)<input name="share_percent" type="number" min="0" max="90" step="0.5" defaultValue="70" /></label>
              <small>This is an offer, not an automatic entitlement. The creator sees and accepts it in Studio.</small>
            </div>
            <div className="actions">
              <button className="primary" name="decision" value="accepted">Accept & offer deal</button>
              <button className="secondary" name="decision" value="reviewing">Mark reviewing</button>
              <button className="secondary" name="decision" value="waitlisted">Waitlist</button>
              <button className="secondary" name="decision" value="declined">Decline</button>
            </div>
          </form>
        )) : <p>No creator applications are waiting.</p>}</div>
      </section>
    </main>
  );
}

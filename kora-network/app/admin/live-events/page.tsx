import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prepareArtistProfile, reviewLiveEvent, setArtistProfilePublication, updateArtistProfile } from './actions';

export default async function LiveEventOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const [applicationsResult, profilesResult] = await Promise.all([
    supabase.from('live_event_applications')
      .select('id,artist_name,contact_email,country_code,genre,event_type,proposed_date,venue_name,venue_city,expected_audience,broadcast_setup,portfolio_url,event_description,rights_confirmed,venue_permission_status,family_safe_confirmed,status,review_notes,submitted_at')
      .in('status', ['submitted','reviewing','rehearsal','waitlisted','approved'])
      .order('submitted_at'),
    supabase.from('artist_profiles')
      .select('id,live_application_id,slug,display_name,country_code,primary_genre,bio,portfolio_url,public_booking_email,website_url,social_url,is_published'),
  ]);
  const profiles = new Map((profilesResult.data ?? []).map((item) => [item.live_application_id, item]));

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA LIVE EVENT OPERATIONS</div><h1>From artist application to public discovery.</h1><p>No application becomes a live event or public artist profile until rights, venue, safety and technical checks are complete.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {applicationsResult.error ? <div className="panel"><strong>The live-event schema must be activated before this queue can open.</strong></div> : null}
        {profilesResult.error ? <div className="panel"><strong>Schema 17 must be activated before artist-page curation can open.</strong></div> : null}
        <div className="panel"><h3>Live-event applications</h3>{(applicationsResult.data ?? []).length ? (applicationsResult.data ?? []).map(app => {
          const artistProfile = profiles.get(app.id);
          return (
            <article className="moderationItem" key={app.id}>
              <div>
                <strong>{app.artist_name}</strong>
                <p>{app.genre} • {app.event_type} • {app.country_code} • {app.status}</p>
                <p>{app.proposed_date || 'Date not set'} • {app.venue_name || 'Venue not set'}{app.venue_city ? `, ${app.venue_city}` : ''} • audience {app.expected_audience ?? 'unknown'}</p>
                <p>{app.event_description}</p>
                <p>Rights: {app.rights_confirmed ? 'confirmed' : 'missing'} • venue permission: {app.venue_permission_status} • family safe: {app.family_safe_confirmed ? 'confirmed' : 'missing'} • setup: {app.broadcast_setup}</p>
                <a href={`mailto:${app.contact_email}`}>{app.contact_email}</a>{app.portfolio_url ? <> • <a href={app.portfolio_url} target="_blank" rel="noreferrer">Open portfolio ↗</a></> : null}
              </div>

              <form action={reviewLiveEvent} className="formPanel">
                <input type="hidden" name="application_id" value={app.id}/>
                <label>Operations notes<textarea name="review_notes" rows={3} defaultValue={app.review_notes ?? ''}/></label>
                <div className="actions">
                  <button className="secondary" name="decision" value="reviewing">Reviewing</button>
                  <button className="primary" name="decision" value="rehearsal">Invite to rehearsal</button>
                  <button className="secondary" name="decision" value="waitlisted">Waitlist</button>
                  <button className="secondary" name="decision" value="approved">Approve pilot</button>
                  <button className="secondary" name="decision" value="declined">Decline</button>
                </div>
              </form>

              {app.status === 'approved' && !artistProfile ? (
                <form action={prepareArtistProfile}>
                  <input type="hidden" name="application_id" value={app.id}/>
                  <button className="primary">Prepare curated artist page</button>
                  <p><small>This copies approved public-facing artist information only. The private application email is not copied to the public profile.</small></p>
                </form>
              ) : null}

              {artistProfile ? (
                <div className="panel">
                  <h3>Artist page • {artistProfile.is_published ? 'PUBLIC' : 'DRAFT'}</h3>
                  <p>/artists/{artistProfile.slug}</p>
                  <form action={updateArtistProfile} className="formPanel">
                    <input type="hidden" name="profile_id" value={artistProfile.id}/>
                    <div className="formGrid">
                      <label>Public artist name<input name="display_name" required defaultValue={artistProfile.display_name}/></label>
                      <label>Country code<input name="country_code" maxLength={2} required defaultValue={artistProfile.country_code}/></label>
                      <label>Primary genre<input name="primary_genre" required defaultValue={artistProfile.primary_genre}/></label>
                      <label>Public booking email<input name="public_booking_email" type="email" defaultValue={artistProfile.public_booking_email ?? ''} placeholder="Optional — never taken from private application email"/></label>
                      <label>Website<input name="website_url" type="url" defaultValue={artistProfile.website_url ?? ''}/></label>
                      <label>Social / channel link<input name="social_url" type="url" defaultValue={artistProfile.social_url ?? ''}/></label>
                      <label>Portfolio / listen link<input name="portfolio_url" type="url" defaultValue={artistProfile.portfolio_url ?? ''}/></label>
                    </div>
                    <label>Public biography<textarea name="bio" rows={6} minLength={40} required defaultValue={artistProfile.bio}/></label>
                    <button className="secondary">Save artist page</button>
                  </form>
                  <form action={setArtistProfilePublication}>
                    <input type="hidden" name="profile_id" value={artistProfile.id}/>
                    <button className={artistProfile.is_published ? 'secondary' : 'primary'} name="publish" value={artistProfile.is_published ? 'false' : 'true'}>{artistProfile.is_published ? 'Unpublish artist page' : 'Publish approved artist page'}</button>
                  </form>
                </div>
              ) : null}
            </article>
          );
        }) : <p>No live-event applications are waiting.</p>}</div>
      </section>
    </main>
  );
}

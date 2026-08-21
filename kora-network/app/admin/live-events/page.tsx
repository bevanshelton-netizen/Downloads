import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reviewLiveEvent } from './actions';

export default async function LiveEventOperations({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const result = await supabase.from('live_event_applications')
    .select('id,artist_name,contact_email,country_code,genre,event_type,proposed_date,venue_name,venue_city,expected_audience,broadcast_setup,portfolio_url,event_description,rights_confirmed,venue_permission_status,family_safe_confirmed,status,review_notes,submitted_at')
    .in('status', ['submitted','reviewing','rehearsal','waitlisted','approved'])
    .order('submitted_at');

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA LIVE EVENT OPERATIONS</div><h1>From artist application to broadcast rehearsal.</h1><p>No application becomes a live event until rights, venue, safety and technical checks are complete.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {result.error ? <div className="panel"><strong>The schema 15 live-event migration must be applied before this queue can open.</strong></div> : null}
        <div className="panel"><h3>Live-event applications</h3>{(result.data ?? []).length ? (result.data ?? []).map(app => (
          <form action={reviewLiveEvent} className="moderationItem" key={app.id}>
            <input type="hidden" name="application_id" value={app.id}/>
            <div>
              <strong>{app.artist_name}</strong>
              <p>{app.genre} • {app.event_type} • {app.country_code} • {app.status}</p>
              <p>{app.proposed_date || 'Date not set'} • {app.venue_name || 'Venue not set'}{app.venue_city ? `, ${app.venue_city}` : ''} • audience {app.expected_audience ?? 'unknown'}</p>
              <p>{app.event_description}</p>
              <p>Rights: {app.rights_confirmed ? 'confirmed' : 'missing'} • venue permission: {app.venue_permission_status} • family safe: {app.family_safe_confirmed ? 'confirmed' : 'missing'} • setup: {app.broadcast_setup}</p>
              <a href={`mailto:${app.contact_email}`}>{app.contact_email}</a>{app.portfolio_url ? <> • <a href={app.portfolio_url} target="_blank" rel="noreferrer">Open portfolio ↗</a></> : null}
            </div>
            <label>Operations notes<textarea name="review_notes" rows={3} defaultValue={app.review_notes ?? ''}/></label>
            <div className="actions">
              <button className="secondary" name="decision" value="reviewing">Reviewing</button>
              <button className="primary" name="decision" value="rehearsal">Invite to rehearsal</button>
              <button className="secondary" name="decision" value="waitlisted">Waitlist</button>
              <button className="secondary" name="decision" value="approved">Approve pilot</button>
              <button className="secondary" name="decision" value="declined">Decline</button>
            </div>
          </form>
        )) : <p>No live-event applications are waiting.</p>}</div>
      </section>
    </main>
  );
}

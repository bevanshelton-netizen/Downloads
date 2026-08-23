import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitLiveEventApplication } from './actions';

export default async function LiveEventApply({ searchParams }: { searchParams: Promise<{ error?: string; submitted?: string; status?: string }> }) {
  const { error, submitted, status } = await searchParams;
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect('/login?next=/perform-live/apply');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/perform-live/apply');

  const { data: application } = await supabase.from('live_event_applications')
    .select('artist_name,contact_email,country_code,genre,event_type,proposed_date,venue_name,venue_city,expected_audience,broadcast_setup,portfolio_url,event_description,venue_permission_status,status')
    .eq('user_id', user.id)
    .maybeSingle();

  const locked = application && !['submitted','waitlisted'].includes(application.status);

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA FOUNDING ARTISTS • LIVE PILOT APPLICATION</div>
        <h1>Bring us the performance you want the world to see.</h1>
        <p>This application starts a controlled review—not an automatic broadcast. KORA verifies rights, venue permission, safety and technical readiness before confirming any event.</p>
      </section>
      <section>
        {submitted ? <div className="panel"><h3>Application received.</h3><p>KORA can now review your proposed event. Keep an eye on this page for your current stage.</p><Link className="secondary" href="/perform-live">Return to Perform Live</Link></div> : null}
        {(status || locked) ? <div className="panel"><h3>Current stage: {status || application?.status}</h3><p>Your application is locked while KORA operations reviews it.</p></div> : null}
        {error ? <div className="panel" role="alert"><strong>{error}</strong></div> : null}
        {!locked ? (
          <form action={submitLiveEventApplication} className="panel formPanel">
            <h3>Proposed live event</h3>
            <div className="formGrid">
              <label>Artist / group name<input name="artist_name" required minLength={2} defaultValue={application?.artist_name ?? ''}/></label>
              <label>Contact email<input name="contact_email" type="email" required defaultValue={application?.contact_email ?? user.email ?? ''}/></label>
              <label>Country code<input name="country_code" required maxLength={2} defaultValue={application?.country_code ?? 'ZA'}/></label>
              <label>Primary genre<input name="genre" required placeholder="Amapiano, Gospel, Jazz..." defaultValue={application?.genre ?? ''}/></label>
              <label>Event type<select name="event_type" required defaultValue={application?.event_type ?? ''}><option value="">Choose one</option><option value="concert">Concert</option><option value="festival">Festival</option><option value="gospel">Gospel / faith event</option><option value="dj_set">DJ set</option><option value="comedy">Comedy</option><option value="spoken_word">Spoken word</option><option value="cultural">Cultural performance</option><option value="other">Other</option></select></label>
              <label>Proposed date<input name="proposed_date" type="date" defaultValue={application?.proposed_date ?? ''}/></label>
              <label>Venue name<input name="venue_name" defaultValue={application?.venue_name ?? ''}/></label>
              <label>Venue city<input name="venue_city" defaultValue={application?.venue_city ?? ''}/></label>
              <label>Expected in-person audience<input name="expected_audience" type="number" min="0" step="1" defaultValue={application?.expected_audience ?? ''}/></label>
            </div>
            <label>Venue permission<select name="venue_permission_status" required defaultValue={application?.venue_permission_status ?? 'not_started'}><option value="confirmed">Confirmed</option><option value="in_progress">In progress</option><option value="not_started">Not started</option><option value="not_applicable">Not applicable / online studio</option></select></label>
            <label>Broadcast setup<select name="broadcast_setup" required defaultValue={application?.broadcast_setup ?? 'need_support'}><option value="professional_crew">Professional video crew</option><option value="obs_ready">OBS / streaming setup ready</option><option value="phone_only">Phone cameras only</option><option value="need_support">Need KORA production support</option></select></label>
            <label>Music, portfolio or social link<input name="portfolio_url" type="url" placeholder="https://..." defaultValue={application?.portfolio_url ?? ''}/></label>
            <label>Describe the performance<textarea name="event_description" rows={7} required minLength={40} defaultValue={application?.event_description ?? ''} placeholder="Tell us about the show, audience, programme and why it belongs on KORA."/></label>
            <label className="check"><input name="rights_confirmed" type="checkbox" required/>I control, or will obtain, the rights needed to stream this performance, music and participating performers.</label>
            <label className="check"><input name="family_safe_confirmed" type="checkbox" required/>This proposal follows KORA’s family-safe policy and contains no pornography or explicit sexual content.</label>
            <small>Do not submit identity-document images, banking passwords or card details here. KORA will request any later verification through a protected process.</small>
            <button className="primary">Submit live-event application</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

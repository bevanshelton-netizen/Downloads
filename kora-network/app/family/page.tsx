import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createChildProfile, deleteChildProfile, enterChildMode, setFamilyPin } from './actions';

export default async function Family({ searchParams }: { searchParams: Promise<{ error?: string; pin?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/family');
  const { error, pin } = await searchParams;

  const [{ data: profiles }, { data: hasPinData }] = await Promise.all([
    supabase.from('viewer_profiles').select('id,nickname,profile_kind,age_band,max_age_rating,purchases_allowed,rewards_allowed,personalised_ads_allowed,created_at').eq('owner_id', user.id).order('created_at'),
    supabase.rpc('has_family_pin'),
  ]);
  const childProfiles = (profiles ?? []).filter(p => p.profile_kind === 'child');
  const hasPin = hasPinData === true;

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA FAMILY</div><h1>Parent-managed viewing, without building profiles around children's personal data.</h1><p>Kids profiles use a nickname and broad age band — not an exact birth date. Purchases, cash rewards and personalised advertising are disabled for every child profile at database level.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {pin ? <div className="panel"><strong>Family PIN saved.</strong> Keep it private from children using Kids Mode.</div> : null}
        <div className="grid three">
          <form action={setFamilyPin} className="panel formPanel">
            <h3>{hasPin ? 'Change family PIN' : 'Set family PIN'}</h3>
            <p>The PIN is required to exit locked Kids Mode and to change child profiles. Only a boolean “PIN configured” state is exposed to the app; the hash itself is not selectable by viewers.</p>
            {hasPin ? <label>Current PIN<input name="current_pin" type="password" inputMode="numeric" minLength={4} maxLength={6} required /></label> : null}
            <label>New PIN<input name="new_pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} required /></label>
            <label>Confirm new PIN<input name="confirm_pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} required /></label>
            <button className="secondary">{hasPin ? 'Change PIN' : 'Set PIN'}</button>
          </form>
          <form action={createChildProfile} className="panel formPanel" style={{gridColumn:'span 2'}}>
            <h3>Create Kids profile</h3>
            <div className="formGrid"><label>Nickname<input name="nickname" maxLength={40} required placeholder="e.g. Lethu" /></label><label>Age band<select name="age_band" required><option value="under_7">Under 7 — A-rated only</option><option value="7_12">7–12 — up to PG</option><option value="13_15">13–15 — up to 13</option><option value="16_17">16–17 — up to 16</option></select></label></div>
            <label>Family PIN<input name="family_pin" type="password" inputMode="numeric" minLength={4} maxLength={6} required disabled={!hasPin} /></label>
            <button className="primary" disabled={!hasPin}>Create child profile</button>
            {!hasPin ? <small>Set the family PIN first.</small> : null}
          </form>
        </div>

        <div className="panel"><h3>Kids profiles</h3>{childProfiles.length ? childProfiles.map(profile => <div className="productionRow" key={profile.id}>
          <div><strong>{profile.nickname}</strong><span>{profile.age_band.replace('_','–')} • max rating {profile.max_age_rating} • no purchases • no rewards • no personalised ads</span></div>
          <div className="actions">
            <form action={enterChildMode}><input type="hidden" name="profile_id" value={profile.id} /><button className="primary">Launch Kids Mode</button></form>
            <form action={deleteChildProfile} className="inlineForm"><input type="hidden" name="profile_id" value={profile.id} /><input name="family_pin" type="password" inputMode="numeric" placeholder="PIN" minLength={4} maxLength={6} required /><button className="secondary">Delete</button></form>
          </div>
        </div>) : <p>No Kids profiles yet.</p>}</div>
      </section>
    </main>
  );
}

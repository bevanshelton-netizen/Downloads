import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createFamilyProfile, setParentalPin } from './actions';

export default async function Family({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;
  const [{ data: profiles }, { data: pin }] = await Promise.all([
    supabase.from('family_profiles').select('id,name,profile_type,max_age_rating,purchases_allowed,rewards_allowed').eq('owner_id', user.id).order('created_at'),
    supabase.from('parental_pins').select('owner_id').eq('owner_id', user.id).maybeSingle(),
  ]);

  return <main>
    <section className="subHero"><div className="eyebrow">KORA FAMILY</div><h1>One household. Safer viewing.</h1><p>Child and teen profiles default to no purchases and no cash rewards. Parents set the maximum age rating and protect changes with a PIN.</p></section>
    <section className="grid three">
      <form action={createFamilyProfile} className="panel formPanel" style={{gridColumn:'span 2'}}>
        <h3>Add family profile</h3>{error ? <p role="alert">{error}</p> : null}
        <label>Name<input name="name" required /></label>
        <div className="formGrid">
          <label>Profile type<select name="profile_type" defaultValue="child"><option value="child">Child</option><option value="teen">Teen</option><option value="adult">Adult</option></select></label>
          <label>Maximum rating<select name="max_age_rating" defaultValue="PG"><option>A</option><option>PG</option><option>13</option><option>16</option><option>18</option></select></label>
        </div>
        <label className="checkLine"><input type="checkbox" name="purchases_allowed" /> Allow purchases on adult profile</label>
        <label className="checkLine"><input type="checkbox" name="rewards_allowed" /> Allow rewards on adult profile</label>
        <button className="primary">Create profile</button>
      </form>
      <form action={setParentalPin} className="panel formPanel"><h3>Parental PIN</h3><p>{pin ? 'PIN is configured.' : 'Set a PIN before enabling Kids mode on a household.'}</p><label>4–8 digit PIN<input name="pin" type="password" inputMode="numeric" minLength={4} maxLength={8} required /></label><button className="secondary">Set / change PIN</button></form>
    </section>
    <section><div className="panel"><h3>Profiles</h3>{(profiles ?? []).length ? (profiles ?? []).map(p => <div className="productionRow" key={p.id}><strong>{p.name} • {p.profile_type}</strong><span>Up to {p.max_age_rating} • purchases {p.purchases_allowed ? 'on' : 'off'} • rewards {p.rewards_allowed ? 'on' : 'off'}</span></div>) : <p>No family profiles yet.</p>}</div></section>
  </main>;
}

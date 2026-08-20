import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updatePassword } from './actions';

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=Open%20your%20password%20recovery%20link%20first');
  const { error } = await searchParams;

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA ACCOUNT RECOVERY</div><h1>Choose a new password.</h1><p>Use at least eight characters and keep it unique to KORA.</p></section>
      <section><form action={updatePassword} className="panel formPanel" style={{ maxWidth: 680 }}>
        {error ? <p role="alert">{error}</p> : null}
        <label>New password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <label>Confirm password<input name="confirm_password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <button className="primary" type="submit">Update password</button>
      </form></section>
    </main>
  );
}

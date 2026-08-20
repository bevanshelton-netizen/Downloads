import { updatePassword } from './actions';

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA ACCOUNT RECOVERY</div><h1>Choose a new password.</h1><p>Your recovery link created a temporary secure session. Set the new password below.</p></section>
      <section>
        <form action={updatePassword} className="panel formPanel" style={{ maxWidth: 680 }}>
          {error ? <p role="alert">{error}</p> : null}
          <label>New password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <label>Confirm password<input name="confirm_password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <div className="actions"><button className="primary" type="submit">Save new password</button></div>
        </form>
      </section>
    </main>
  );
}

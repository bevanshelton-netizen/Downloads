import Link from 'next/link';
import { sendPasswordReset } from './actions';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA ACCOUNT RECOVERY</div><h1>Reset your password.</h1><p>Enter the email used for your KORA account. We’ll send a secure recovery link if the account exists.</p></section>
      <section>
        <form action={sendPasswordReset} className="panel formPanel" style={{ maxWidth: 680 }}>
          {error ? <p role="alert">{error}</p> : null}
          {message ? <p><strong>{message}</strong></p> : null}
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <div className="actions"><button className="primary" type="submit">Send reset link</button><Link className="secondary" href="/login">Back to sign in</Link></div>
        </form>
      </section>
    </main>
  );
}

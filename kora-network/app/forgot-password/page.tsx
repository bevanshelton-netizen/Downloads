import Link from 'next/link';
import { requestPasswordReset } from './actions';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const { message, error } = await searchParams;
  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA ACCOUNT RECOVERY</div><h1>Reset your password.</h1><p>Enter the email linked to your KORA account. We will send a secure recovery link.</p></section>
      <section>
        <form action={requestPasswordReset} className="panel formPanel" style={{ maxWidth: 680 }}>
          {message ? <p><strong>{message}</strong></p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <div className="actions"><button className="primary" type="submit">Send reset link</button><Link className="secondary" href="/login">Back to sign in</Link></div>
        </form>
      </section>
    </main>
  );
}

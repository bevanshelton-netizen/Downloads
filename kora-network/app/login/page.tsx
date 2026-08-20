import Link from 'next/link';
import { legal } from '@/lib/legal';
import { signIn, signUp } from './actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/studio';
  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA ACCOUNT</div>
        <h1>Watch. Create. Build an audience.</h1>
        <p>One account powers viewing, creator tools, rewards and advertiser access.</p>
      </section>
      <section className="grid three">
        <article className="panel" style={{ gridColumn: 'span 2' }}>
          <h3>Sign in or create your account</h3>
          {error ? <p role="alert">{error}</p> : null}
          {message ? <p><strong>{message}</strong></p> : null}
          <form style={{ display: 'grid', gap: 14, maxWidth: 620 }}>
            <input type="hidden" name="next" value={safeNext} />
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Password<input name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
            <label className="check"><input name="platform_accepted" type="checkbox" /> For a new account, I accept the <Link href="/legal/terms">Terms of Use v{legal.platformTerms.version}</Link> and acknowledge the <Link href="/legal/privacy">Privacy Notice v{legal.privacyNotice.version}</Link>.</label>
            <small>The checkbox is required only when creating a new account; existing users can sign in without re-accepting this version.</small>
            <div className="actions">
              <button className="primary" formAction={signIn}>Sign in</button>
              <button className="secondary" formAction={signUp}>Create account</button>
              <Link className="secondary" href="/forgot-password">Forgot password?</Link>
            </div>
          </form>
        </article>
        <article className="panel">
          <h3>Creator-first</h3>
          <p>Creators retain their IP by default. Publishing is rights-declared, moderated and pornography or explicit sexual content is prohibited.</p>
        </article>
      </section>
    </main>
  );
}

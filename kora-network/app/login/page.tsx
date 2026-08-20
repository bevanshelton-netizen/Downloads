import { signIn, signUp } from './actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
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
          <form style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Password<input name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
            <div className="actions">
              <button className="primary" formAction={signIn}>Sign in</button>
              <button className="secondary" formAction={signUp}>Create account</button>
            </div>
          </form>
        </article>
        <article className="panel">
          <h3>Creator-first</h3>
          <p>Creators retain their IP by default. Publishing is moderated and pornography or explicit sexual content is prohibited.</p>
        </article>
      </section>
    </main>
  );
}

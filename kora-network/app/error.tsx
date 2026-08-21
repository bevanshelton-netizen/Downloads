'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content">
      <section className="subHero">
        <div className="eyebrow">KORA RECOVERY</div>
        <h1>The screen hit a temporary problem.</h1>
        <p>Your account and payment state are not changed by this page. Retry the view, or return to a safe public destination.</p>
        <div className="actions">
          <button className="primary" type="button" onClick={() => reset()}>Try again</button>
          <Link className="secondary" href="/">KORA home</Link>
          <Link className="secondary" href="/account">My KORA</Link>
        </div>
      </section>
    </main>
  );
}

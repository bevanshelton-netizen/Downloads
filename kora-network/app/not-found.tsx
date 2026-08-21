import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content">
      <section className="subHero">
        <div className="eyebrow">404 • OFF AIR</div>
        <h1>That screen is not on KORA.</h1>
        <p>The programme, channel or page may have moved, may not be published yet, or may only be available inside an authorised workspace.</p>
        <div className="actions">
          <Link className="primary" href="/">Go to KORA home</Link>
          <Link className="secondary" href="/watch">Browse On Demand</Link>
          <Link className="secondary" href="/live">Open Live TV</Link>
        </div>
      </section>
    </main>
  );
}

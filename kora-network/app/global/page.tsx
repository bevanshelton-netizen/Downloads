import Link from 'next/link';

const corridors = ['Africa → Europe','Africa → Korea','Africa → Americas','Africa → Middle East','Africa → Asia','World → Africa'];

export default function GlobalPage() {
  return <main><section className="subHero"><div className="eyebrow">KORA GLOBAL</div><h1>Africa to the world. The world to Africa.</h1><p>A global entertainment corridor for artists, agencies, rights holders, promoters, broadcasters and strategic partners.</p><div className="actions"><Link className="primary" href="/partner">Partner with KORA</Link><Link className="secondary" href="/creators">For Creators</Link></div></section><section className="grid two">{corridors.map(corridor => <article className="panel" key={corridor}><h3>{corridor}</h3><p>International discovery, rights, events, distribution and audience opportunities subject to verified partnerships and licensed rights.</p></article>)}</section></main>;
}

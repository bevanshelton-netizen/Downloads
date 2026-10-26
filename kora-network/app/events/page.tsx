import Link from 'next/link';

const eventTypes = ['Concerts','Festivals','Gospel','Comedy','Conferences','Masterclasses','Sports','Hybrid events'];

export default function EventsPage() {
  return <main><section className="subHero"><div className="eyebrow">KORA EVENTS</div><h1>Create → Promote → Sell → Perform → Stream → Get Paid.</h1><p>One event journey for entertainment, culture, education and live experiences.</p><div className="actions"><Link className="primary" href="/account">Start with KORA</Link><Link className="secondary" href="/live">Explore Live</Link></div></section><section className="grid two">{eventTypes.map(type => <article className="panel" key={type}><h3>{type}</h3><p>Build an event experience with ticketing, audience access and streaming options where supported.</p></article>)}</section></main>;
}

import Link from 'next/link';

const destinations = [
  { icon: '♫', title: 'For Music', text: 'Artists, DJs, producers and music communities.', href: '/music?utm_source=kora&utm_medium=homepage&utm_campaign=growth&utm_content=music' },
  { icon: '●', title: 'For Kids & ECD', text: 'Teachers, ECD practitioners, parents and families.', href: '/kids?utm_source=kora&utm_medium=homepage&utm_campaign=growth&utm_content=kids-ecd' },
  { icon: '✦', title: 'For Creators', text: 'Filmmakers, performers and media professionals.', href: '/creators?utm_source=kora&utm_medium=homepage&utm_campaign=growth&utm_content=creators' },
  { icon: '▣', title: 'For Advertisers', text: 'Brands seeking African audiences and media partners.', href: '/advertise?utm_source=kora&utm_medium=homepage&utm_campaign=growth&utm_content=advertisers' },
];

export default function GrowthCta() {
  return (
    <section className="koraGrowth" aria-labelledby="kora-growth-title">
      <div className="koraGrowthHead">
        <div>
          <small>GROW KORA WITH US</small>
          <h2 id="kora-growth-title">One network. Every community.</h2>
          <p>Share the part of KORA that belongs in your world — and help African stories, creators and audiences travel further.</p>
        </div>
        <Link className="primary" href="/partners?utm_source=kora&utm_medium=homepage&utm_campaign=growth&utm_content=partners">Partner with KORA →</Link>
      </div>
      <div className="koraGrowthGrid">
        {destinations.map((item) => (
          <Link key={item.title} className="koraGrowthCard" href={item.href}>
            <span className="koraGrowthIcon">{item.icon}</span>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
            <b>Open & share →</b>
          </Link>
        ))}
      </div>
      <p className="koraGrowthNote">Every KORA page also carries a contextual <strong>Share &amp; Promote</strong> action with campaign-tagged links.</p>
    </section>
  );
}

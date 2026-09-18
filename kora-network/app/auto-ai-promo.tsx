'use client';

const offers = [
  {
    name: 'AUTO AI',
    hook: 'R99 Repair Quote Second Opinion',
    href: 'https://auto-ai-eosin.vercel.app/?utm_source=kora&utm_medium=global_revenue_launcher&utm_campaign=push_push_push#pricing',
  },
  {
    name: 'FAISReady',
    hook: 'RE5 from R299',
    href: 'https://faisready-revenue.vercel.app/?utm_source=kora&utm_medium=global_revenue_launcher&utm_campaign=push_push_push#courses',
  },
  {
    name: 'Regulatory Exams',
    hook: 'RE1 + RE5 bundle R549',
    href: 'https://mandatory-regulatory-exams.vercel.app/?utm_source=kora&utm_medium=global_revenue_launcher&utm_campaign=push_push_push#faisready',
  },
];

export default function AutoAiPromo() {
  return (
    <aside className="autoAiPromo" aria-label="Useful services from our network">
      <div className="autoAiPromoHead">
        <strong>USEFUL SERVICES • OPEN NOW</strong>
        <span>Tap straight into the service you need.</span>
      </div>
      <div className="autoAiPromoLinks">
        {offers.map((offer) => (
          <a key={offer.name} href={offer.href} target="_blank" rel="noopener noreferrer">
            <b>{offer.name}</b>
            <small>{offer.hook}</small>
            <em>Open →</em>
          </a>
        ))}
      </div>
    </aside>
  );
}

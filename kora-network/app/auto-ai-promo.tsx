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
    href: 'https://pay.ikhokha.com/izakhono/buy/re5completeprepara',
  },
  {
    name: 'Regulatory Exams',
    hook: 'RE1 + RE5 bundle R549',
    href: 'https://pay.ikhokha.com/izakhono/buy/re5-and-re1-complete-p',
  },
];

const shareText = [
  'Useful services open now:',
  'AUTO AI — R99 Repair Quote Second Opinion: https://auto-ai-eosin.vercel.app/?utm_source=kora&utm_medium=share_offers&utm_campaign=push_push_push#pricing',
  'FAISReady — RE5 R299 direct checkout: https://pay.ikhokha.com/izakhono/buy/re5completeprepara',
  'RE1 + RE5 bundle R549 direct checkout: https://pay.ikhokha.com/izakhono/buy/re5-and-re1-complete-p',
].join('\n');

export default function AutoAiPromo() {
  async function shareOffers() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Useful services from our network', text: shareText });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        window.alert('Offer links copied. Share them anywhere.');
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    window.prompt('Copy and share these offers:', shareText);
  }

  return (
    <aside className="autoAiPromo" aria-label="Useful services from our network">
      <div className="autoAiPromoHead">
        <div>
          <strong>USEFUL SERVICES • OPEN NOW</strong>
          <span>Tap straight into the service you need.</span>
        </div>
        <button type="button" onClick={() => void shareOffers()}>↗ Share offers</button>
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

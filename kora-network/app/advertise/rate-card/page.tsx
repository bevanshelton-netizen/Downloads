import Link from 'next/link';

const packages = [
  { name: 'STARTER', price: 'R7,500 / month', copy: 'Entry campaign package for brands testing KORA audience fit.', includes: ['Contextual placement', 'Approved creative review', 'Campaign summary'] },
  { name: 'PREMIUM', price: 'R25,000 / month', copy: 'Stronger presence across selected KORA programming and communities.', includes: ['Expanded inventory', 'Show or genre association', 'Performance reporting'] },
  { name: 'GLOBAL', price: 'R75,000 / month', copy: 'For brands seeking broader African and diaspora positioning.', includes: ['Multi-format campaign', 'Priority partnership planning', 'Territory-aware reporting'] },
  { name: 'GLOBAL EXCLUSIVE', price: 'From R250,000', copy: 'Custom strategic sponsorship for major launches, premieres or cultural moments.', includes: ['Category or programme exclusivity where available', 'Custom integration', 'Executive campaign planning'] },
];

const campaignFormats = [
  ['SPORTS SPONSOR', 'From R100,000 / campaign'],
  ['ENTERTAINMENT', 'From R50,000 / campaign'],
  ['MUSIC', 'From R35,000 / campaign'],
  ['FAITH', 'From R25,000 / campaign'],
  ['AFRICA MARKET ENTRY', 'From R150,000 / campaign'],
  ['GLOBAL MEDIA PARTNER', 'From R1,000,000 / year'],
];

export const metadata = {
  title: 'Media Kit & Rate Card | KORA',
  description: 'KORA advertising, sponsorship and media partnership packages.',
};

export default function RateCardPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#050608,#0d1020)', color: '#fff' }}>
      <section style={{ width: 'min(1180px,92vw)', margin: '0 auto', padding: '78px 0 42px' }}>
        <div style={{ color: '#e6c76b', fontSize: 11, fontWeight: 900, letterSpacing: '.18em' }}>KORA MEDIA KIT • COMMERCIAL PARTNERSHIPS</div>
        <h1 style={{ fontSize: 'clamp(3rem,8vw,7rem)', lineHeight: .88, letterSpacing: '-.06em', margin: '14px 0 22px' }}>PUT YOUR BRAND<br /><span style={{ color: '#e6c76b' }}>ON THE AFRICAN SCREEN.</span></h1>
        <p style={{ maxWidth: 820, color: '#c7ccd7', fontSize: 19, lineHeight: 1.65 }}>KORA offers advertising, sponsorship, creator and media partnership opportunities built around African entertainment and audiences. These are starting packages; final inventory, territory, duration, placement and exclusivity are confirmed in a commercial proposal.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
          <a href="mailto:info@streamkoraafrica.com?subject=KORA%20Media%20Kit%20Request" style={{ padding: '14px 22px', borderRadius: 999, background: 'linear-gradient(135deg,#f1d47b,#c79a3d)', color: '#17130a', fontWeight: 900 }}>Request Media Kit →</a>
          <Link href="/advertise" style={{ padding: '14px 22px', borderRadius: 999, border: '1px solid #ffffff30', fontWeight: 900 }}>Explore KORA Advertising</Link>
        </div>
        <p style={{ marginTop: 14, color: '#8f96a4', fontSize: 12 }}>Commercial enquiry: info@streamkoraafrica.com. Public mailbox activation remains subject to KORA mail acceptance verification.</p>
      </section>

      <section style={{ width: 'min(1180px,92vw)', margin: '0 auto', padding: '20px 0 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {packages.map((item) => (
            <article key={item.name} style={{ padding: 25, borderRadius: 24, border: '1px solid #ffffff18', background: '#ffffff07' }}>
              <div style={{ color: '#76fff0', fontSize: 10, fontWeight: 900, letterSpacing: '.16em' }}>{item.name}</div>
              <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>{item.price}</h2>
              <p style={{ color: '#bdc3cf', lineHeight: 1.5, minHeight: 70 }}>{item.copy}</p>
              <ul style={{ paddingLeft: 19, color: '#e3e6ec', lineHeight: 1.8 }}>{item.includes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section style={{ width: 'min(1180px,92vw)', margin: '0 auto', padding: '0 0 70px' }}>
        <div style={{ color: '#e6c76b', fontSize: 11, fontWeight: 900, letterSpacing: '.18em' }}>SPECIALIST CAMPAIGNS</div>
        <h2 style={{ fontSize: 'clamp(2rem,5vw,4rem)', letterSpacing: '-.04em' }}>Campaigns can be built around the audience.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
          {campaignFormats.map(([name, price]) => <div key={name} style={{ padding: 20, borderRadius: 18, background: '#ffffff08', border: '1px solid #ffffff14' }}><strong>{name}</strong><div style={{ color: '#e6c76b', marginTop: 8 }}>{price}</div></div>)}
        </div>
      </section>

      <section style={{ width: 'min(980px,92vw)', margin: '0 auto', padding: '0 0 90px', textAlign: 'center' }}>
        <div style={{ padding: '45px 30px', borderRadius: 30, background: 'linear-gradient(110deg,#1a3f8f,#702c9c,#c23c78)' }}>
          <h2 style={{ fontSize: 'clamp(2.2rem,5vw,4.5rem)', lineHeight: .95, margin: '0 0 16px' }}>Ready to reach KORA audiences?</h2>
          <p style={{ color: '#eee', lineHeight: 1.6 }}>Send your brand, campaign objective, territory and timing. KORA can then prepare the appropriate commercial proposal.</p>
          <a href="mailto:info@streamkoraafrica.com?subject=KORA%20Advertising%20Enquiry" style={{ display: 'inline-block', marginTop: 18, padding: '14px 24px', borderRadius: 999, background: '#fff', color: '#211335', fontWeight: 900 }}>Start Commercial Enquiry →</a>
        </div>
      </section>
    </main>
  );
}

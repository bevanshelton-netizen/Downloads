import Link from 'next/link';
import CommercialLead from './commercial-client';

export const metadata={
  title:{ absolute:'Sponsor & Advertise — YHVH GOSPEL TV' },
  description:'Commercial partnerships, sponsorship, event broadcast, distribution and production opportunities with YHVH GOSPEL TV.'
};

const offers=[
  {
    id:'founding-partner',
    eyebrow:'FOUNDING PARTNERSHIP',
    title:'Founding / Presenting Partner',
    copy:'High-visibility channel association, launch campaigns and agreed brand inventory — while YHVH GOSPEL TV keeps full editorial independence.',
    image:'https://images.unsplash.com/photo-1541190349433-a490ea73206a?auto=format&fit=crop&q=82&w=1400'
  },
  {
    id:'programme-sponsor',
    eyebrow:'PROGRAMME SPONSORSHIP',
    title:'Programme Sponsor',
    copy:'Associate your brand with suitable recurring Gospel, family and faith programming through clearly agreed sponsor inventory.',
    image:'https://images.unsplash.com/photo-1772419186982-d59b3374f794?auto=format&fit=crop&q=82&w=1400'
  },
  {
    id:'event-broadcast',
    eyebrow:'LIVE EVENTS',
    title:'Live Event Broadcast',
    copy:'Broadcast or simulcast Gospel concerts, conferences, worship events and revivals after technical, editorial and rights clearance.',
    image:'https://images.unsplash.com/photo-1541190349433-a490ea73206a?auto=format&fit=crop&q=82&w=1400'
  },
  {
    id:'regional-distribution',
    eyebrow:'GLOBAL DISTRIBUTION',
    title:'Regional Distribution',
    copy:'Discuss OTT, smart-TV, platform, territory and syndication opportunities for approved YHVH GOSPEL TV programming.',
    image:'https://images.unsplash.com/photo-1541190349433-a490ea73206a?auto=format&fit=crop&q=82&w=1400'
  },
  {
    id:'advertising',
    eyebrow:'BRAND OPPORTUNITY',
    title:'Faith-aligned Advertising',
    copy:'Place suitable brand campaigns in a Gospel and family-focused environment, subject to YHVH GOSPEL TV suitability review.',
    image:'https://images.unsplash.com/photo-1772419186982-d59b3374f794?auto=format&fit=crop&q=82&w=1400'
  },
  {
    id:'production-services',
    eyebrow:'PRODUCTION',
    title:'Production Services',
    copy:'Remote production, recording, graphics, broadcast packaging, channel integration and event-delivery support.',
    image:'https://images.unsplash.com/photo-1759860709045-8cd767e85371?auto=format&fit=crop&q=82&w=1400'
  }
];

const principles=[
  ['GOSPEL-ONLY POSITIONING','A clear faith-and-family environment with a distinct channel identity.'],
  ['GLOBAL DIGITAL DELIVERY','Public digital distribution today, with IZAKHONO authority retained as the platform grows.'],
  ['EDITORIAL INDEPENDENCE','Commercial participation never buys ministry endorsement or editorial approval.']
];

export default function CommercialDesk(){
  const primaryUrl=process.env.YHVH_GOSPEL_PRIMARY_URL||process.env.KORA_GOSPEL_PRIMARY_URL||'https://gospel.domains.izakhonoafrica.co.za';
  const externalUrl=process.env.NEXT_PUBLIC_YHVH_GOSPEL_EXTERNAL_INTAKE_URL||process.env.NEXT_PUBLIC_GOSPEL_EXTERNAL_INTAKE_URL||'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/kora-gospel-intake';

  return <main id="main-content" className="yhvhCommercial">
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
      .yhvhCommercial{
        min-height:100vh;color:#fff;padding:26px 0 76px;
        font-family:"Manrope",sans-serif;
        background:
          radial-gradient(circle at 10% 0%,rgba(125,21,56,.27),transparent 28%),
          radial-gradient(circle at 92% 1%,rgba(245,196,81,.14),transparent 24%),
          linear-gradient(180deg,#050c18,#07111f 58%,#081323);
      }
      .yhvhCommercial h1,.yhvhCommercial h2,.yhvhCommercial h3,.yhvhCommercial .serif{font-family:"Cormorant Garamond",Georgia,serif}
      .commercialWrap{width:min(1180px,92vw);margin:0 auto}
      .backLink{color:#f6dc98;font-weight:800;text-decoration:none;font-size:.9rem}
      .commercialHero{
        position:relative;overflow:hidden;min-height:640px;border-radius:34px;margin-top:18px;
        border:1px solid rgba(245,196,81,.18);box-shadow:0 30px 90px rgba(0,0,0,.38);
      }
      .commercialHero>img.heroBg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 44%;filter:saturate(.78) contrast(1.04)}
      .commercialHero:after{
        content:"";position:absolute;inset:0;
        background:
          linear-gradient(90deg,rgba(4,10,20,.98) 0%,rgba(4,10,20,.91) 38%,rgba(4,10,20,.55) 70%,rgba(4,10,20,.72) 100%),
          linear-gradient(180deg,rgba(4,10,20,.04),rgba(4,10,20,.82));
      }
      .commercialHeroCopy{position:relative;z-index:2;min-height:640px;display:flex;flex-direction:column;justify-content:space-between;padding:38px}
      .commercialLogo{width:min(340px,72vw);height:auto;filter:drop-shadow(0 18px 32px rgba(0,0,0,.45))}
      .eyebrow{color:#f5c451;font-weight:900;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase}
      .commercialHero h1{font-size:clamp(3.8rem,8vw,7.4rem);line-height:.8;letter-spacing:-.045em;margin:11px 0 17px;max-width:900px}
      .commercialHero h1 span{color:#f5c451}
      .commercialHero p{max-width:760px;font-size:1.06rem;line-height:1.8;color:#dfe7f2;margin:0}
      .heroActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
      .goldBtn,.ghostBtn{
        display:inline-flex;align-items:center;justify-content:center;padding:13px 19px;border-radius:999px;
        font-weight:900;text-decoration:none;transition:transform .18s ease,border-color .18s ease;
      }
      .goldBtn{background:linear-gradient(135deg,#f5c451,#dea03a);color:#2c2108;box-shadow:0 14px 30px rgba(229,157,29,.2)}
      .ghostBtn{border:1px solid rgba(255,255,255,.18);color:#fff;background:rgba(255,255,255,.06);backdrop-filter:blur(10px)}
      .goldBtn:hover,.ghostBtn:hover{transform:translateY(-2px)}
      .signalBar{
        display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin:18px 0 42px;border:1px solid rgba(255,255,255,.1);
        border-radius:18px;overflow:hidden;background:rgba(255,255,255,.08)
      }
      .signalBar div{padding:16px 18px;background:#091729}
      .signalBar b{display:block;font-size:.72rem;color:#f5c451;letter-spacing:.12em;margin-bottom:5px}
      .signalBar span{color:#d4deeb;font-size:.85rem}
      .sectionHead{margin-bottom:22px}
      .sectionHead h2{font-size:clamp(2.8rem,5vw,4.6rem);line-height:.92;margin:7px 0 12px;letter-spacing:-.035em}
      .sectionHead p{max-width:790px;color:#adbdcf;line-height:1.75}
      .offerGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:52px}
      .offerCard{
        position:relative;min-height:360px;overflow:hidden;border-radius:26px;border:1px solid rgba(245,196,81,.13);
        box-shadow:0 20px 52px rgba(0,0,0,.2);background:#0b1729;
      }
      .offerCard img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.72) contrast(1.08);transition:transform .55s ease}
      .offerCard:hover img{transform:scale(1.035)}
      .offerCard:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,12,24,.04) 0%,rgba(5,12,24,.22) 30%,rgba(5,12,24,.96) 100%)}
      .offerCopy{position:absolute;z-index:2;left:22px;right:22px;bottom:22px}
      .offerCopy small{display:block;color:#f5c451;font-weight:900;letter-spacing:.12em;font-size:.66rem;margin-bottom:7px}
      .offerCopy h3{font-size:2rem;line-height:1;margin:0 0 10px}
      .offerCopy p{margin:0;color:#d0dbe8;line-height:1.55;font-size:.9rem}
      .commercialFormShell{
        display:grid;grid-template-columns:.78fr 1.22fr;gap:18px;margin-top:8px;padding:18px;border-radius:30px;
        border:1px solid rgba(245,196,81,.16);background:linear-gradient(135deg,rgba(75,16,41,.42),rgba(8,22,39,.94));
        box-shadow:0 24px 70px rgba(0,0,0,.2)
      }
      .commercialFormIntro{position:relative;overflow:hidden;min-height:100%;border-radius:22px;padding:28px;background:#081526;border:1px solid rgba(255,255,255,.08)}
      .commercialFormIntro:after{content:"✦";position:absolute;right:18px;bottom:-20px;font-family:Georgia,serif;font-size:10rem;color:rgba(245,196,81,.055)}
      .commercialFormIntro h2{font-size:3.1rem;line-height:.95;margin:10px 0 14px}
      .commercialFormIntro p{color:#afbed0;line-height:1.7}
      .process{display:grid;gap:13px;margin-top:26px}
      .process div{display:grid;grid-template-columns:32px 1fr;gap:10px;align-items:start}
      .process b{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(245,196,81,.28);color:#f5c451}
      .process span{color:#d7e1ed;line-height:1.55;font-size:.9rem}
      .trustGrid{margin-top:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .trustCard{padding:22px;border-radius:22px;background:#0a192b;border:1px solid rgba(255,255,255,.1)}
      .trustCard b{display:block;color:#f5c451;font-size:.72rem;letter-spacing:.12em;margin-bottom:8px}
      .trustCard p{margin:0;color:#adbdcf;line-height:1.6;font-size:.9rem}
      .photoCredit{margin-top:20px;font-size:.68rem;color:#72839a;line-height:1.5}
      .photoCredit a{color:#9fb0c4}
      @media(max-width:900px){
        .offerGrid{grid-template-columns:1fr 1fr}.commercialFormShell{grid-template-columns:1fr}.signalBar{grid-template-columns:1fr 1fr}
        .commercialHero,.commercialHeroCopy{min-height:620px}
      }
      @media(max-width:560px){
        .offerGrid{grid-template-columns:1fr}.signalBar{grid-template-columns:1fr}.commercialHero,.commercialHeroCopy{min-height:690px}
        .commercialHeroCopy{padding:24px}.commercialHero h1{font-size:3.8rem}.commercialFormShell{padding:10px}.trustGrid{grid-template-columns:1fr}
      }
    `}</style>

    <div className="commercialWrap">
      <Link href="/gospel" className="backLink">← YHVH GOSPEL TV</Link>

      <section className="commercialHero">
        <img className="heroBg" src="https://images.unsplash.com/photo-1541190349433-a490ea73206a?auto=format&fit=crop&q=84&w=2000" alt="Worship audience facing a professionally lit church stage"/>
        <div className="commercialHeroCopy">
          <img className="commercialLogo" src="/images/yhvh-gospel-tv-logo-dove.png" alt="YHVH GOSPEL TV"/>
          <div>
            <div className="eyebrow">Global commercial desk</div>
            <h1>PARTNER WITH<br/><span>GOSPEL TV.</span></h1>
            <p>Build meaningful reach around Gospel music, worship, family programming and live Christian events through sponsorship, suitable advertising, event broadcasting, production and distribution partnerships.</p>
            <div className="heroActions">
              <a className="goldBtn" href="#commercial-form">Request commercial proposal →</a>
              <Link className="ghostBtn" href="/gospel">View the channel</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="signalBar" aria-label="Commercial partnership highlights">
        <div><b>CHANNEL</b><span>Gospel-only positioning</span></div>
        <div><b>DELIVERY</b><span>Global digital distribution</span></div>
        <div><b>OPPORTUNITIES</b><span>Sponsor • Advertise • Broadcast</span></div>
        <div><b>CONTROL</b><span>IZAKHONO authority retained</span></div>
      </div>

      <section>
        <div className="sectionHead">
          <div className="eyebrow">Commercial opportunities</div>
          <h2>Choose how your organisation wants to participate.</h2>
          <p>Every partnership is structured around a clear commercial objective while preserving YHVH GOSPEL TV’s Gospel identity, rights standards and editorial independence.</p>
        </div>
        <div className="offerGrid">
          {offers.map(o=><article className="offerCard" key={o.id}>
            <img src={o.image} alt="" loading="lazy"/>
            <div className="offerCopy"><small>{o.eyebrow}</small><h3>{o.title}</h3><p>{o.copy}</p></div>
          </article>)}
        </div>
      </section>

      <section id="commercial-form" className="commercialFormShell">
        <aside className="commercialFormIntro">
          <div className="eyebrow">Start a commercial conversation</div>
          <h2>Tell us what you want to achieve.</h2>
          <p>Give us the opportunity, market, timing and indicative budget. We’ll use that information to shape a proposal around the right YHVH Gospel TV commercial path.</p>
          <div className="process">
            <div><b>1</b><span><strong>Submit your brief.</strong><br/>Tell us the opportunity and who you want to reach.</span></div>
            <div><b>2</b><span><strong>IZAKHONO review.</strong><br/>We assess suitability, rights, delivery and the correct commercial format.</span></div>
            <div><b>3</b><span><strong>Proposal discussion.</strong><br/>Qualified opportunities move into a tailored commercial conversation.</span></div>
          </div>
        </aside>
        <CommercialLead primaryUrl={primaryUrl} externalUrl={externalUrl}/>
      </section>

      <section className="trustGrid">
        {principles.map(([title,copy])=><article className="trustCard" key={title}><b>{title}</b><p>{copy}</p></article>)}
      </section>

      <p className="photoCredit">Selected commercial imagery via Unsplash. Worship-event image by Tajmia Loiacono, faith-stage image by AMONWAT DUMKRUT, and production-console image by Tymofii Tarasov.</p>
    </div>
  </main>;
}

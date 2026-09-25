import type { Metadata } from 'next';
import GospelDistribution from './gospel-distribution';
import GospelChannelClock from './channel-clock';

export const metadata: Metadata = {
  title: { absolute: 'YHVH GOSPEL TV — Faith. Worship. Word.' },
  description: 'A premium Gospel-only television network from Africa to the world — worship, preaching, Gospel music, testimony, family programming and live Christian events.',
  applicationName: 'YHVH GOSPEL TV',
  themeColor: '#07111f',
  openGraph: {
    title: 'YHVH GOSPEL TV',
    description: 'Faith. Worship. Word. Africa to the World.',
    type: 'website',
    images: ['/images/yhvh-gospel-tv-logo-dove.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YHVH GOSPEL TV',
    description: 'Faith. Worship. Word. Africa to the World.',
    images: ['/images/yhvh-gospel-tv-logo-dove.png'],
  },
};

const shows=[
  ['Morning Glory','Start the day with worship, Scripture and prayer.','05:00'],
  ['Gospel Africa','Music, choirs and voices from across the continent.','07:00 / 17:30'],
  ['The Word','Preaching, teaching and Bible-centred conversation.','10:00'],
  ['Faith Without Borders','Christian stories and ministries across nations.','14:00'],
  ['Gospel Kids','Faith-filled family viewing for younger audiences.','15:00'],
  ['Testimony Hour','Real stories of faith, restoration and hope.','19:00'],
  ['Prime Gospel','The flagship evening Gospel destination.','20:00'],
  ['Revival Nights','Worship, preaching and revival programming.','21:00'],
];

export default function GospelPage() {
  const primaryUrl = process.env.KORA_GOSPEL_PRIMARY_URL || 'https://gospel.domains.izakhonoafrica.co.za';
  const pagesUrl = process.env.KORA_GOSPEL_PAGES_URL || 'https://bevanshelton-netizen.github.io/Downloads/yhvh-gospel-tv/';

  return (
    <main id="main-content" className="yhvhLaunch">
      <style>{`
        .top, body > footer, .autoAiPromo, .globalShareButton { display:none !important; }
        body{background:#050c18}
        .yhvhLaunch{--gold:#f5c451;--gold2:#ffe29a;--ink:#050c18;--panel:#0b182b;--muted:#aebcd0;min-height:100vh;color:#fff;background:
          radial-gradient(circle at 8% 0%,rgba(103,55,170,.22),transparent 27%),
          radial-gradient(circle at 97% 2%,rgba(245,196,81,.13),transparent 23%),
          linear-gradient(180deg,#050c18,#07111f 54%,#081323);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .yhvhWrap{width:min(1180px,92vw);margin:0 auto}
        .yhvhNav{position:sticky;top:0;z-index:30;background:rgba(5,12,24,.86);backdrop-filter:blur(16px);border-bottom:1px solid rgba(245,196,81,.12)}
        .yhvhNavInner{height:74px;display:flex;align-items:center;justify-content:space-between;gap:20px}
        .yhvhNavBrand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#fff;font-weight:900;letter-spacing:.06em}
        .yhvhNavBrand img{width:52px;height:52px;object-fit:contain;filter:drop-shadow(0 8px 16px rgba(0,0,0,.35))}
        .yhvhNavLinks{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.yhvhNavLinks a{color:#d8e2ee;text-decoration:none;font-weight:800;font-size:.88rem}
        .yhvhNavLinks a:hover{color:var(--gold2)}.yhvhNavWatch{padding:10px 15px;border-radius:999px;background:linear-gradient(135deg,var(--gold),#e59d1d);color:#291d07!important}
        .yhvhHero{padding:38px 0 22px}
        .yhvhStage{position:relative;min-height:650px;border-radius:34px;overflow:hidden;border:1px solid rgba(245,196,81,.18);box-shadow:0 30px 90px rgba(0,0,0,.35)}
        .yhvhStage>img.heroPhoto{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%;filter:saturate(.82) contrast(1.03)}
        .yhvhShade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,12,24,.98) 0%,rgba(5,12,24,.84) 46%,rgba(5,12,24,.32) 78%,rgba(5,12,24,.68) 100%),linear-gradient(180deg,rgba(5,12,24,.03),rgba(5,12,24,.9))}
        .yhvhHeroContent{position:relative;z-index:2;min-height:650px;padding:38px;display:flex;flex-direction:column;justify-content:space-between}
        .yhvhLogo{width:min(350px,70vw);height:auto;filter:drop-shadow(0 18px 35px rgba(0,0,0,.45))}
        .yhvhPill{display:inline-flex;align-items:center;gap:9px;padding:8px 12px;border-radius:999px;background:rgba(125,21,56,.94);font-size:.74rem;font-weight:900;letter-spacing:.13em}
        .yhvhPill i{width:7px;height:7px;border-radius:50%;background:#ff6179;box-shadow:0 0 0 5px rgba(255,97,121,.12)}
        .yhvhTitle{font-family:Georgia,"Times New Roman",serif;font-size:clamp(3.6rem,8vw,7.2rem);line-height:.83;letter-spacing:-.055em;margin:18px 0 16px;max-width:940px}
        .yhvhTitle span{color:var(--gold)}
        .yhvhLead{font-size:clamp(1rem,2vw,1.18rem);line-height:1.7;max-width:760px;color:#e3eaf4}
        .heroActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.heroActions a{padding:13px 18px;border-radius:999px;text-decoration:none;font-weight:900}
        .heroActions .primary{background:linear-gradient(135deg,var(--gold),#e59d1d);color:#2d2108}.heroActions .secondary{border:1px solid rgba(255,255,255,.18);color:#fff;background:rgba(255,255,255,.06)}
        .launchGrid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;padding:18px 0 34px}
        .channelClock{padding:24px;border-radius:26px;border:1px solid rgba(245,196,81,.19);background:linear-gradient(145deg,rgba(15,31,56,.97),rgba(7,18,34,.97));box-shadow:0 20px 52px rgba(0,0,0,.2)}
        .clockTop{display:flex;align-items:center;gap:9px;color:#f7d681;font-size:.72rem;font-weight:900;letter-spacing:.12em}.clockTop strong{margin-left:auto;color:#fff;font-size:.86rem}.clockLiveDot{width:8px;height:8px;border-radius:50%;background:#ed385a;box-shadow:0 0 0 5px rgba(237,56,90,.12)}
        .clockMain{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;margin-top:24px}.clockMain small,.clockNext small{color:#8295ad;font-weight:900;letter-spacing:.11em}.clockMain h2{font-family:Georgia,serif;font-size:clamp(2rem,4vw,3.5rem);margin:7px 0 5px}.clockMain p{margin:0;color:#aebcd0}.clockNext{text-align:right}.clockNext strong{display:block;font-size:1.05rem;margin:8px 0 4px}.clockNext span{color:#f7d681;font-size:.86rem}
        .clockProgress{height:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:22px}.clockProgress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8c1a41,var(--gold))}
        .clockNote{font-size:.76rem;color:#8295ad;line-height:1.45;margin:12px 0 0}
        .section{padding:28px 0 54px}.sectionEyebrow{color:#f7d681;font-size:.72rem;letter-spacing:.14em;font-weight:900}.section h2{font-family:Georgia,serif;font-size:clamp(2.5rem,5vw,4.8rem);line-height:.95;letter-spacing:-.035em;margin:10px 0 12px}.sectionIntro{color:#b8c5d5;line-height:1.75;max-width:820px}
        .storyGrid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:26px}.storyMain,.storySide{position:relative;overflow:hidden;border-radius:28px;border:1px solid rgba(255,255,255,.1);min-height:420px}.storySide{display:grid;gap:16px;border:0;overflow:visible}.storySmall{position:relative;overflow:hidden;border-radius:26px;border:1px solid rgba(255,255,255,.1);min-height:202px}.storyGrid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.storyGrid .veil{position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(3,8,16,.9))}.storyCopy{position:absolute;z-index:2;left:22px;right:22px;bottom:20px}.storyCopy small{color:var(--gold);font-weight:900;letter-spacing:.12em}.storyCopy strong{display:block;font-family:Georgia,serif;font-size:clamp(1.7rem,3vw,3rem);margin-top:5px}
        .showGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-top:26px}.showCard{position:relative;min-height:180px;padding:20px;border-radius:22px;border:1px solid rgba(245,196,81,.12);background:linear-gradient(145deg,rgba(21,39,73,.8),rgba(7,18,34,.96));overflow:hidden}.showCard:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--gold),transparent)}.showCard small{color:#f7d681;font-weight:900;letter-spacing:.1em}.showCard h3{font-family:Georgia,serif;font-size:1.4rem;margin:18px 0 8px}.showCard p{color:#9fb0c5;line-height:1.5;margin:0}.showTime{position:absolute;right:18px;bottom:16px;color:#fff;font-weight:900;font-size:.78rem}
        .partnerPanel{position:relative;overflow:hidden;padding:34px;border-radius:30px;border:1px solid rgba(245,196,81,.18);background:radial-gradient(circle at 88% 0%,rgba(245,196,81,.16),transparent 24%),linear-gradient(135deg,rgba(75,16,41,.62),rgba(9,21,38,.97) 58%,rgba(9,28,44,.96))}.partnerPanel h2{max-width:760px}.partnerActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.partnerActions a{padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:900}.partnerActions .gold{background:var(--gold);color:#2d2108}.partnerActions .outline{border:1px solid rgba(255,255,255,.18);color:#fff}
        .worldPanel{position:relative;overflow:hidden;min-height:450px;border-radius:30px;border:1px solid rgba(245,196,81,.15);background:linear-gradient(135deg,#091729,#050c18)}.worldPanel img{position:absolute;right:-3%;top:50%;transform:translateY(-50%);width:min(720px,70%);opacity:.9}.worldCopy{position:relative;z-index:2;padding:36px;max-width:570px}.worldCopy p{color:#c6d2df;line-height:1.75}.worldTags{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.worldTags span{padding:8px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.04);font-size:.76rem;color:#d7e1ee}
        .mobileWatch{display:none}
        @media(max-width:900px){.yhvhNavLinks a:not(.yhvhNavWatch){display:none}.launchGrid,.storyGrid{grid-template-columns:1fr}.showGrid{grid-template-columns:1fr 1fr}.yhvhStage,.yhvhHeroContent{min-height:610px}.clockMain{grid-template-columns:1fr}.clockNext{text-align:left}.worldPanel img{opacity:.42;width:95%;right:-25%}}
        @media(max-width:560px){.yhvhWrap{width:min(94vw,1180px)}.yhvhNavInner{height:66px}.yhvhNavBrand span{display:none}.yhvhHero{padding-top:18px}.yhvhStage,.yhvhHeroContent{min-height:650px}.yhvhHeroContent{padding:24px}.yhvhLogo{width:72%}.yhvhTitle{font-size:3.55rem}.showGrid{grid-template-columns:1fr}.storyMain{min-height:360px}.worldCopy{padding:24px}.worldPanel{min-height:520px}.mobileWatch{display:block;position:fixed;z-index:40;left:12px;right:12px;bottom:12px;padding:13px 18px;border-radius:999px;background:linear-gradient(135deg,var(--gold),#e59d1d);color:#2d2108;text-align:center;text-decoration:none;font-weight:950;box-shadow:0 18px 45px rgba(0,0,0,.42)}.yhvhLaunch{padding-bottom:72px}}
      `}</style>

      <nav className="yhvhNav">
        <div className="yhvhWrap yhvhNavInner">
          <a className="yhvhNavBrand" href="/gospel"><img src="/images/yhvh-gospel-tv-logo-dove.png" alt=""/><span>YHVH GOSPEL TV</span></a>
          <div className="yhvhNavLinks">
            <a href="#shows">Shows</a><a href="/gospel/worldwide">Worldwide</a><a href="/gospel/join">Submit / Join</a><a href="/gospel/commercial">Partner</a>
            <a className="yhvhNavWatch" href="/gospel/live">Watch now →</a>
          </div>
        </div>
      </nav>

      <section className="yhvhHero">
        <div className="yhvhWrap">
          <div className="yhvhStage">
            <img className="heroPhoto" src="https://images.unsplash.com/photo-1729548627958-ea4900cb6645?auto=format&fit=crop&q=82&w=1800" alt="Worshippers gathered during praise"/>
            <div className="yhvhShade"/>
            <div className="yhvhHeroContent">
              <img className="yhvhLogo" src="/images/yhvh-gospel-tv-logo-dove.png" alt="YHVH Gospel TV"/>
              <div>
                <span className="yhvhPill"><i/> GOSPEL ONLY · WORLDWIDE</span>
                <h1 className="yhvhTitle">FAITH. WORSHIP.<br/><span>WORD.</span> TO THE WORLD.</h1>
                <p className="yhvhLead">A premium Gospel-only television destination for worship, preaching, Gospel music, testimony, family programming and Christian events — carrying African faith and global Gospel voices across nations.</p>
                <div className="heroActions">
                  <a className="primary" href="/gospel/live">▶ Watch YHVH Gospel TV</a>
                  <a className="secondary" href="/gospel/join">Submit content / join network</a>
                </div>
              </div>
            </div>
          </div>

          <div className="launchGrid">
            <GospelChannelClock/>
            <GospelDistribution primaryUrl={primaryUrl} pagesUrl={pagesUrl}/>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="yhvhWrap">
          <div className="sectionEyebrow">AFRICA TO THE WORLD</div>
          <h2>A Gospel network that looks and feels like television.</h2>
          <p className="sectionIntro">One channel identity, one Gospel-only promise, a published 24-hour programme clock and a worldwide contributor network — with IZAKHONO retaining the engine, editorial authority and owned infrastructure.</p>
          <div className="storyGrid">
            <div className="storyMain">
              <img src="https://images.unsplash.com/photo-1689844759889-f8d92bd8a03a?auto=format&fit=crop&q=82&w=1400" alt="Church worship gathering"/>
              <div className="veil"/><div className="storyCopy"><small>WORSHIP · COMMUNITY</small><strong>Faith lives in real communities.</strong></div>
            </div>
            <div className="storySide">
              <div className="storySmall"><img src="https://images.unsplash.com/photo-1745852738196-4dfed8cbd691?auto=format&fit=crop&q=82&w=1000" alt="Gospel choir performing"/><div className="veil"/><div className="storyCopy"><small>MUSIC</small><strong>The sound of Gospel.</strong></div></div>
              <div className="storySmall"><img src="https://images.unsplash.com/photo-1777421389422-519764272b2f?auto=format&fit=crop&q=82&w=1000" alt="Bible in warm light"/><div className="veil"/><div className="storyCopy"><small>THE WORD</small><strong>Rooted in Scripture.</strong></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="shows" className="section">
        <div className="yhvhWrap">
          <div className="sectionEyebrow">24-HOUR PROGRAMME CLOCK</div>
          <h2>Something worth tuning in for, all day.</h2>
          <p className="sectionIntro">The published channel clock combines worship, Gospel music, preaching, family programming, testimony and international Christian stories.</p>
          <div className="showGrid">
            {shows.map(([title,copy,time])=><article className="showCard" key={title}><small>YHVH ORIGINAL STRAND</small><h3>{title}</h3><p>{copy}</p><span className="showTime">{time} SAST</span></article>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="yhvhWrap">
          <div className="partnerPanel">
            <div className="sectionEyebrow">OPEN FOR PARTNERSHIPS</div>
            <h2>Sponsor. Advertise. Broadcast your Gospel event.</h2>
            <p className="sectionIntro">Founding sponsorship, programme sponsorship, event broadcasting, faith-aligned advertising, production and regional distribution conversations are open. Commercial participation never buys editorial approval.</p>
            <div className="partnerActions">
              <a className="gold" href="/gospel/commercial?utm_source=gospel_home&utm_medium=launch&utm_campaign=public_launch">Request commercial proposal →</a>
              <a className="outline" href="/gospel/join">Church / artist / event submission</a>
              <a className="outline" href="https://wa.me/?text=YHVH%20GOSPEL%20TV%20%E2%80%94%20Faith.%20Worship.%20Word.%20Africa%20to%20the%20World.%20https%3A%2F%2Fkora-network.vercel.app%2Fgospel" target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="yhvhWrap">
          <div className="worldPanel">
            <img src="/images/yhvh-broadcast-globe.svg" alt="YHVH Gospel TV worldwide broadcast network"/>
            <div className="worldCopy">
              <div className="sectionEyebrow">WORLDWIDE GOSPEL</div>
              <h2>One Gospel family. Many nations.</h2>
              <p>Africa, the Americas, Europe, Asia, the Caribbean and the Pacific — bringing churches, artists, choirs, worship traditions and Christian stories into one professional Gospel media destination.</p>
              <div className="worldTags"><span>English</span><span>French</span><span>Portuguese</span><span>Spanish</span><span>Swahili</span><span>isiZulu</span><span>isiXhosa</span></div>
              <div className="partnerActions"><a className="gold" href="/gospel/worldwide">Explore worldwide network →</a><a className="outline" href="/gospel/join">Join from your region</a></div>
            </div>
          </div>
        </div>
      </section>

      <a className="mobileWatch" href="/gospel/live">▶ Watch YHVH Gospel TV</a>
    </main>
  );
}

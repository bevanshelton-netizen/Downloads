import Link from 'next/link';
import GlobalIntake from './intake-client';

export const metadata={
  title:'Join KORA GOSPEL TV Worldwide',
  description:'Global Gospel content, church, artist, broadcaster, event, sponsor and distribution-partner intake.'
};

export default function GospelJoin(){
  const primaryUrl=process.env.KORA_GOSPEL_PRIMARY_URL||'https://gospel.domains.izakhonoafrica.co.za';
  const externalUrl=process.env.NEXT_PUBLIC_GOSPEL_EXTERNAL_INTAKE_URL||'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/kora-gospel-intake';
  const cards=[
    ['Churches & Ministries','Services, preaching, worship, documentaries and community stories.'],
    ['Artists & Choirs','Music videos, live sessions, premieres, choir features and interviews.'],
    ['Live Events','Concerts, conferences, revivals and special Gospel broadcasts.'],
    ['Broadcasters & Platforms','Syndication, smart-TV, OTT, FAST/CTV and regional distribution.'],
    ['Sponsors & Advertisers','Faith-aligned commercial partnerships with editorial independence.'],
    ['Global Contributors','Regional correspondents, producers and Christian media partners.']
  ];
  return <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 12% 0%,rgba(43,111,151,.24),transparent 31%),radial-gradient(circle at 95% 8%,rgba(245,196,81,.15),transparent 25%),#06101c',color:'#fff',padding:'54px 0 80px'}}>
    <div style={{width:'min(1140px,92vw)',margin:'0 auto'}}>
      <Link href="/gospel" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>← KORA GOSPEL TV</Link>
      <div style={{marginTop:20,fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#83f0c4'}}>GLOBAL PARTNER & CONTENT ACQUISITION DESK</div>
      <h1 style={{fontSize:'clamp(3rem,8vw,6.8rem)',lineHeight:.88,letterSpacing:'-.06em',margin:'12px 0 18px'}}>BRING YOUR GOSPEL<br/><span style={{color:'#f5c451'}}>TO THE WORLD.</span></h1>
      <p style={{fontSize:18,lineHeight:1.65,maxWidth:850,color:'#c7d4e4'}}>KORA GOSPEL TV is opening a worldwide contributor network for churches, Gospel artists, choirs, broadcasters, live events, sponsors and distribution partners. Submissions enter editorial and rights review before any broadcast commitment.</p>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14,margin:'30px 0'}}>
        {cards.map(([title,copy])=><article key={title} style={{padding:20,borderRadius:20,border:'1px solid rgba(255,255,255,.13)',background:'rgba(255,255,255,.045)'}}><h2 style={{fontSize:20,margin:'0 0 8px'}}>{title}</h2><p style={{margin:0,color:'#9fb0c5',lineHeight:1.55}}>{copy}</p></article>)}
      </section>

      <GlobalIntake primaryUrl={primaryUrl} externalUrl={externalUrl}/>

      <section style={{marginTop:26,padding:22,borderRadius:22,border:'1px solid rgba(255,255,255,.13)',background:'rgba(9,22,39,.85)'}}>
        <small style={{color:'#8ed8ff',fontWeight:900,letterSpacing:'.12em'}}>HYBRID RESILIENCE</small>
        <h2>Owned control. External reach. No single point of failure.</h2>
        <p style={{color:'#b9c8db',lineHeight:1.6}}>IZAKHONO remains the authoritative Gospel TV control plane. KORA/Vercel, GitHub Pages and the external intake buffer keep worldwide discovery and acquisition available when an individual infrastructure layer is unavailable.</p>
      </section>
    </div>
  </main>;
}

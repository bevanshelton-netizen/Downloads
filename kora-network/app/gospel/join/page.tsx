import Link from 'next/link';
import GlobalIntake from './intake-client';

export const metadata={
  title:{ absolute:'Join YHVH GOSPEL TV Worldwide' },
  description:'Apply as a church, ministry, Gospel artist, choir, event, broadcaster, distributor, sponsor or advertiser.'
};

const classes=[
  ['Content Partner','Churches, ministries, producers and Gospel programmes.'],
  ['Artist / Choir Partner','Artists, choirs, worship teams and music-rights owners.'],
  ['Event Partner','Concerts, conferences, revivals and festivals.'],
  ['Distribution / Broadcast Partner','Broadcasters, OTT, FAST/CTV, smart-TV and platform partners.'],
  ['Commercial Partner','Sponsors, advertisers and production clients.']
];

export default function GospelJoin(){
  const primaryUrl=process.env.KORA_GOSPEL_PRIMARY_URL||'https://gospel.domains.izakhonoafrica.co.za';
  const externalUrl=process.env.NEXT_PUBLIC_GOSPEL_EXTERNAL_INTAKE_URL||'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/kora-gospel-intake';
  return <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 12% 0%,rgba(43,111,151,.24),transparent 31%),radial-gradient(circle at 95% 8%,rgba(245,196,81,.15),transparent 25%),#06101c',color:'#fff',padding:'54px 0 80px'}}>
    <div style={{width:'min(1140px,92vw)',margin:'0 auto'}}>
      <Link href="/gospel" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>← YHVH GOSPEL TV</Link>
      <div style={{marginTop:20,fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#83f0c4'}}>GLOBAL PARTNER & CONTENT ACQUISITION DESK</div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(3rem,8vw,6.8rem)',lineHeight:.88,letterSpacing:'-.06em',margin:'12px 0 18px'}}>COME ON BOARD.<br/><span style={{color:'#f5c451'}}>BRING YOUR GOSPEL TO THE WORLD.</span></h1>
      <p style={{fontSize:18,lineHeight:1.65,maxWidth:900,color:'#c7d4e4'}}>YHVH GOSPEL TV is onboarding churches, ministries, Gospel artists, choirs, event promoters, broadcasters, distribution platforms, sponsors and advertisers worldwide. Every application enters the same verification, rights, editorial and safeguarding process before any broadcast or commercial commitment.</p>

      <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'22px 0'}}>
        <Link href="/gospel/charter" style={{padding:'11px 16px',borderRadius:999,background:'#f5c451',color:'#2d2108',fontWeight:950,textDecoration:'none'}}>Read Partner & Contributor Charter →</Link>
        <a href="#apply" style={{padding:'11px 16px',borderRadius:999,border:'1px solid rgba(255,255,255,.16)',color:'#fff',fontWeight:900,textDecoration:'none'}}>Apply now ↓</a>
      </div>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,margin:'30px 0'}}>
        {classes.map(([title,copy])=><article key={title} style={{padding:20,borderRadius:20,border:'1px solid rgba(255,255,255,.13)',background:'rgba(255,255,255,.045)'}}><small style={{color:'#f5c451',fontWeight:900,letterSpacing:'.08em'}}>PARTNER CLASS</small><h2 style={{fontSize:20,margin:'8px 0'}}>{title}</h2><p style={{margin:0,color:'#9fb0c5',lineHeight:1.55}}>{copy}</p></article>)}
      </section>

      <section style={{padding:22,borderRadius:22,border:'1px solid rgba(245,196,81,.18)',background:'linear-gradient(135deg,rgba(75,16,41,.32),rgba(8,21,38,.9))',marginBottom:24}}>
        <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>THE RULE BEFORE THE DEAL</small>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(1.8rem,4vw,3rem)',margin:'8px 0 10px'}}>Money never buys editorial approval.</h2>
        <p style={{margin:0,color:'#bbc8d8',lineHeight:1.6}}>Submission is review, not acceptance. Rights, identity, safeguarding and suitability checks come before scheduling. Revenue sharing, sponsorship, licensing or distribution terms are documented separately where applicable.</p>
      </section>

      <div id="apply"><GlobalIntake primaryUrl={primaryUrl} externalUrl={externalUrl}/></div>

      <section style={{marginTop:26,padding:22,borderRadius:22,border:'1px solid rgba(255,255,255,.13)',background:'rgba(9,22,39,.85)'}}>
        <small style={{color:'#8ed8ff',fontWeight:900,letterSpacing:'.12em'}}>ONBOARDING PIPELINE</small>
        <h2>Apply → verify → review → agree → QC → schedule.</h2>
        <p style={{color:'#b9c8db',lineHeight:1.6}}>IZAKHONO remains the authoritative control plane. If the owned intake route is temporarily unavailable, applications can be buffered externally and reconciled back into the IZAKHONO-owned queue for review.</p>
      </section>
    </div>
  </main>;
}

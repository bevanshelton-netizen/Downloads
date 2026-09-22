import type { Metadata } from 'next';
import GospelDistribution from './gospel-distribution';

export const metadata: Metadata = {
  title: { absolute: 'YHVH GOSPEL TV' },
  description: 'YHVH GOSPEL TV — Gospel-only television on IZAKHONO-owned infrastructure with resilient external distribution.',
  applicationName: 'YHVH GOSPEL TV',
};

export default function GospelPage() {
  const primaryUrl = process.env.KORA_GOSPEL_PRIMARY_URL || 'https://gospel.domains.izakhonoafrica.co.za';
  const pagesUrl = process.env.KORA_GOSPEL_PAGES_URL || 'https://bevanshelton-netizen.github.io/Downloads/yhvh-gospel-tv/';

  return (
    <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 12% 0%,rgba(95,58,168,.24),transparent 30%),radial-gradient(circle at 100% 10%,rgba(245,196,81,.14),transparent 24%),#07111f',color:'#fff'}}>
      <style>{`.top, body > footer, .autoAiPromo, .globalShareButton { display:none !important; } body { background:#07111f; }`}</style>
      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'72px 0 34px'}}>
        <img src="/images/yhvh-gospel-tv-logo-dove.png" alt="YHVH Gospel TV" style={{display:'block',width:'min(430px,82vw)',height:'auto',marginBottom:24}} />
        <div style={{display:'inline-flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:999,background:'#7d1538',fontWeight:900,fontSize:12,letterSpacing:'.12em'}}>● GOSPEL ONLY</div>
        <h1 style={{fontSize:'clamp(3.4rem,8vw,7.2rem)',lineHeight:.86,letterSpacing:'-.065em',margin:'20px 0 18px',maxWidth:980}}>YHVH<br/><span style={{color:'#f5c451'}}>GOSPEL TV</span></h1>
        <p style={{fontSize:'clamp(1rem,2vw,1.2rem)',lineHeight:1.65,maxWidth:820,color:'#dbe4f1'}}>Faith. Worship. Word. Africa to the World. Public delivery is live on zero-cost external infrastructure now, while IZAKHONO remains the channel authority and preferred owned origin.</p>
        <GospelDistribution primaryUrl={primaryUrl} pagesUrl={pagesUrl} />
        <div style={{marginTop:12,display:'flex',gap:16,flexWrap:'wrap'}}><a href="/gospel/commercial" style={{color:'#f5c451',fontWeight:900,textDecoration:'none'}}>Sponsor / advertise →</a><a href="/gospel/join" style={{color:'#7ff0bd',fontWeight:900,textDecoration:'none'}}>Join the global network →</a><a href="/gospel/worldwide" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>Worldwide network →</a><a href="/gospel/distribution" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>View distribution map →</a><a href={primaryUrl.replace(/\/$/,'') + '/control.html'} target="_blank" rel="noopener noreferrer" style={{color:'#8ed8ff',fontWeight:900,textDecoration:'none'}}>Owner control room ↗</a></div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'10px 0 34px'}}>
        <div style={{padding:24,borderRadius:26,border:'1px solid rgba(245,196,81,.28)',background:'linear-gradient(135deg,rgba(125,21,56,.34),rgba(10,23,43,.92))'}}>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#ffe29a'}}>REVENUE SPRINT · OPEN FOR BUSINESS</div>
          <h2 style={{fontSize:'clamp(2rem,4vw,3.4rem)',margin:'10px 0 12px'}}>Sponsor. Advertise. Broadcast your Gospel event.</h2>
          <p style={{maxWidth:820,color:'#c7d4e4',lineHeight:1.6}}>YHVH GOSPEL TV is live on a zero-budget public stack so revenue can fund the infrastructure we need next. Commercial enquiries are open now.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
            <a href="/gospel/commercial?utm_source=gospel_home&utm_medium=revenue_sprint&utm_campaign=launch" style={{padding:'12px 18px',borderRadius:999,background:'#f5c451',color:'#2d2108',fontWeight:900,textDecoration:'none'}}>Request commercial proposal →</a>
            <a href="https://wa.me/?text=YHVH%20GOSPEL%20TV%20is%20live.%20Faith.%20Worship.%20Word.%20Africa%20to%20the%20World.%20https%3A%2F%2Fkora-network.vercel.app%2Fgospel" target="_blank" rel="noopener noreferrer" style={{padding:'12px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.18)',color:'#fff',fontWeight:900,textDecoration:'none'}}>Share on WhatsApp</a>
          </div>
        </div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'24px 0 70px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
          <article style={{padding:22,border:'1px solid rgba(255,255,255,.13)',borderRadius:22,background:'rgba(255,255,255,.05)'}}>
            <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>PRIMARY</small>
            <h2 style={{margin:'8px 0'}}>IZAKHONO-owned origin</h2>
            <p style={{color:'#b8c5d8',lineHeight:1.55}}>Source of truth for the channel runtime, programme state, submissions, prayer intake and future live broadcast feed.</p>
          </article>
          <article style={{padding:22,border:'1px solid rgba(255,255,255,.13)',borderRadius:22,background:'rgba(255,255,255,.05)'}}>
            <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>DISTRIBUTION</small>
            <h2 style={{margin:'8px 0'}}>Vercel discovery layer</h2>
            <p style={{color:'#b8c5d8',lineHeight:1.55}}>Provides YHVH GOSPEL TV with a fast external discovery surface while IZAKHONO remains authoritative.</p>
          </article>
          <article style={{padding:22,border:'1px solid rgba(255,255,255,.13)',borderRadius:22,background:'rgba(255,255,255,.05)'}}>
            <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>FALLBACK</small>
            <h2 style={{margin:'8px 0'}}>GitHub Pages mirror</h2>
            <p style={{color:'#b8c5d8',lineHeight:1.55}}>A lightweight public fallback for continuity and discoverability if a primary or external compute layer is temporarily unavailable.</p>
          </article>
          <article style={{padding:22,border:'1px solid rgba(255,255,255,.13)',borderRadius:22,background:'rgba(255,255,255,.05)'}}>
            <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>NEXT</small>
            <h2 style={{margin:'8px 0'}}>Social + smart-TV reach</h2>
            <p style={{color:'#b8c5d8',lineHeight:1.55}}>External video and social platforms can carry trailers, clips and approved simulcasts while the owned channel remains authoritative.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

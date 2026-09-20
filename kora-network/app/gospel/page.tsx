import type { Metadata } from 'next';
import GospelDistribution from './gospel-distribution';

export const metadata: Metadata = {
  title: 'KORA GOSPEL TV',
  description: 'KORA GOSPEL TV — Gospel-only television on IZAKHONO-owned infrastructure with resilient external distribution.',
};

export default function GospelPage() {
  const primaryUrl = process.env.KORA_GOSPEL_PRIMARY_URL || 'https://gospel.domains.izakhonoafrica.co.za';
  const pagesUrl = process.env.KORA_GOSPEL_PAGES_URL || 'https://bevanshelton-netizen.github.io/Downloads/kora-gospel-tv/';

  return (
    <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 12% 0%,rgba(95,58,168,.24),transparent 30%),radial-gradient(circle at 100% 10%,rgba(245,196,81,.14),transparent 24%),#07111f',color:'#fff'}}>
      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'72px 0 34px'}}>
        <div style={{display:'inline-flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:999,background:'#7d1538',fontWeight:900,fontSize:12,letterSpacing:'.12em'}}>● GOSPEL ONLY</div>
        <h1 style={{fontSize:'clamp(3.4rem,8vw,7.2rem)',lineHeight:.86,letterSpacing:'-.065em',margin:'20px 0 18px',maxWidth:980}}>KORA<br/><span style={{color:'#f5c451'}}>GOSPEL TV</span></h1>
        <p style={{fontSize:'clamp(1rem,2vw,1.2rem)',lineHeight:1.65,maxWidth:820,color:'#dbe4f1'}}>Faith. Worship. Word. Africa to the World. The channel is owned and controlled on IZAKHONO infrastructure, while KORA, Vercel and GitHub Pages remain active as distribution and resilience layers.</p>
        <GospelDistribution primaryUrl={primaryUrl} pagesUrl={pagesUrl} />
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
            <h2 style={{margin:'8px 0'}}>KORA + Vercel</h2>
            <p style={{color:'#b8c5d8',lineHeight:1.55}}>Keeps Gospel TV visible inside the broader KORA audience and provides a fast external discovery surface.</p>
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

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
      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'48px 0 34px'}}>
        <div style={{position:'relative',minHeight:620,borderRadius:32,overflow:'hidden',border:'1px solid rgba(245,196,81,.18)',boxShadow:'0 26px 80px rgba(0,0,0,.35)'}}>
          <img src="https://images.unsplash.com/photo-1729548627958-ea4900cb6645?auto=format&fit=crop&q=82&w=1800" alt="Worshippers gathered with hands raised during praise" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 45%',filter:'saturate(.82)'}} />
          <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,rgba(5,12,24,.97) 0%,rgba(5,12,24,.78) 47%,rgba(5,12,24,.34) 78%,rgba(5,12,24,.62) 100%),linear-gradient(180deg,rgba(5,12,24,.04),rgba(5,12,24,.86))'}} />
          <div style={{position:'relative',zIndex:2,padding:'36px',display:'flex',flexDirection:'column',minHeight:620,justifyContent:'space-between'}}>
            <img src="/images/yhvh-gospel-tv-logo-dove.png" alt="YHVH Gospel TV" style={{display:'block',width:'min(360px,70vw)',height:'auto',filter:'drop-shadow(0 18px 35px rgba(0,0,0,.45))'}} />
            <div>
              <div style={{display:'inline-flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:999,background:'rgba(125,21,56,.92)',fontWeight:900,fontSize:12,letterSpacing:'.12em'}}>● GOSPEL ONLY</div>
              <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(3.4rem,8vw,7rem)',lineHeight:.84,letterSpacing:'-.055em',margin:'18px 0 16px',maxWidth:920}}>FAITH. WORSHIP.<br/><span style={{color:'#f5c451'}}>WORD.</span> TO THE WORLD.</h1>
              <p style={{fontSize:'clamp(1rem,2vw,1.18rem)',lineHeight:1.7,maxWidth:760,color:'#e3eaf4'}}>A premium Gospel-only television destination for worship, preaching, Gospel music, testimony, family programming and live Christian events — carrying African faith and global Gospel voices across nations.</p>
              <div style={{marginTop:18}}><GospelDistribution primaryUrl={primaryUrl} pagesUrl={pagesUrl} /></div>
            </div>
          </div>
        </div>
        <div style={{marginTop:14,display:'flex',gap:16,flexWrap:'wrap'}}><a href="/gospel/commercial" style={{color:'#f5c451',fontWeight:900,textDecoration:'none'}}>Sponsor / advertise →</a><a href="/gospel/join" style={{color:'#7ff0bd',fontWeight:900,textDecoration:'none'}}>Join the global network →</a><a href="/gospel/worldwide" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>Worldwide network →</a><a href="/gospel/distribution" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>View distribution map →</a></div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'10px 0 34px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.2fr .8fr',gap:16}}>
          <div style={{position:'relative',minHeight:420,borderRadius:26,overflow:'hidden',border:'1px solid rgba(255,255,255,.12)'}}>
            <img src="https://images.unsplash.com/photo-1689844759889-f8d92bd8a03a?auto=format&fit=crop&q=82&w=1400" alt="Church worship gathering in Johannesburg" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
            <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 38%,rgba(5,12,24,.9))'}} />
            <div style={{position:'absolute',left:22,right:22,bottom:20}}><small style={{color:'#f5c451',fontWeight:900,letterSpacing:'.12em'}}>JOHANNESBURG • WORSHIP</small><h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(2rem,4vw,3.4rem)',margin:'6px 0 0'}}>Faith lives in real communities.</h2></div>
          </div>
          <div style={{display:'grid',gap:16}}>
            <div style={{position:'relative',minHeight:202,borderRadius:26,overflow:'hidden',border:'1px solid rgba(255,255,255,.12)'}}>
              <img src="https://images.unsplash.com/photo-1745852738196-4dfed8cbd691?auto=format&fit=crop&q=82&w=1000" alt="Gospel choir performing on stage" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
              <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 25%,rgba(5,12,24,.88))'}} />
              <div style={{position:'absolute',left:18,right:18,bottom:16}}><b style={{fontFamily:'Georgia,serif',fontSize:28}}>The sound of Gospel.</b></div>
            </div>
            <div style={{position:'relative',minHeight:202,borderRadius:26,overflow:'hidden',border:'1px solid rgba(255,255,255,.12)'}}>
              <img src="https://images.unsplash.com/photo-1777421389422-519764272b2f?auto=format&fit=crop&q=82&w=1000" alt="Open Bible held in warm sunlight" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
              <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 25%,rgba(5,12,24,.88))'}} />
              <div style={{position:'absolute',left:18,right:18,bottom:16}}><b style={{fontFamily:'Georgia,serif',fontSize:28}}>Rooted in the Word.</b></div>
            </div>
          </div>
        </div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'10px 0 34px'}}>
        <div style={{padding:24,borderRadius:26,border:'1px solid rgba(245,196,81,.28)',background:'linear-gradient(135deg,rgba(125,21,56,.34),rgba(10,23,43,.92))'}}>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#ffe29a'}}>REVENUE SPRINT · OPEN FOR BUSINESS</div>
          <h2 style={{fontSize:'clamp(2rem,4vw,3.4rem)',margin:'10px 0 12px'}}>Sponsor. Advertise. Broadcast your Gospel event.</h2>
          <p style={{maxWidth:820,color:'#c7d4e4',lineHeight:1.6}}>YHVH GOSPEL TV is live and open for commercial partnerships. Founding sponsorship, Gospel event broadcasting and faith-aligned advertising opportunities are available now.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
            <a href="/gospel/commercial?utm_source=gospel_home&utm_medium=revenue_sprint&utm_campaign=launch" style={{padding:'12px 18px',borderRadius:999,background:'#f5c451',color:'#2d2108',fontWeight:900,textDecoration:'none'}}>Request commercial proposal →</a>
            <a href="https://wa.me/?text=YHVH%20GOSPEL%20TV%20is%20live.%20Faith.%20Worship.%20Word.%20Africa%20to%20the%20World.%20https%3A%2F%2Fkora-network.vercel.app%2Fgospel" target="_blank" rel="noopener noreferrer" style={{padding:'12px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.18)',color:'#fff',fontWeight:900,textDecoration:'none'}}>Share on WhatsApp</a>
          </div>
        </div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'24px 0 70px'}}>
        <div style={{position:'relative',overflow:'hidden',minHeight:440,borderRadius:30,border:'1px solid rgba(245,196,81,.16)',background:'linear-gradient(135deg,#091729,#050c18)'}}>
          <img src="/images/yhvh-broadcast-globe.svg" alt="YHVH Gospel TV global broadcast network graphic" style={{position:'absolute',right:'-3%',top:'50%',transform:'translateY(-50%)',width:'min(720px,70%)',height:'auto',opacity:.92}}/>
          <div style={{position:'relative',zIndex:2,padding:34,maxWidth:570}}>
            <small style={{color:'#f5c451',fontWeight:900,letterSpacing:'.14em'}}>WORLDWIDE GOSPEL</small>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(2.8rem,5vw,4.8rem)',lineHeight:.92,margin:'10px 0 14px'}}>One Gospel family. Many nations.</h2>
            <p style={{color:'#c6d2df',lineHeight:1.75}}>Africa, the Americas, Europe, Asia, the Caribbean and the Pacific — bringing churches, artists, choirs, worship traditions and Christian stories into one professional Gospel media destination.</p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}>
              <a href="/gospel/join" style={{padding:'12px 18px',borderRadius:999,background:'#f5c451',color:'#2d2108',fontWeight:900,textDecoration:'none'}}>Join the network →</a>
              <a href="/gospel/worldwide" style={{padding:'12px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.18)',color:'#fff',fontWeight:900,textDecoration:'none'}}>Explore worldwide Gospel</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

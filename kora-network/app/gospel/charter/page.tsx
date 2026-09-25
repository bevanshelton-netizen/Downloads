import Link from 'next/link';
import charter from '../../../public/gospel-partner-charter.json';

export const metadata={
  title:{absolute:'Partner & Contributor Charter — YHVH GOSPEL TV'},
  description:'Rules of engagement for churches, ministries, Gospel artists, choirs, events, broadcasters, distributors, sponsors and advertisers joining YHVH GOSPEL TV.'
};

export default function GospelCharter(){
  return <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 8% 0%,rgba(125,21,56,.25),transparent 28%),radial-gradient(circle at 95% 3%,rgba(245,196,81,.14),transparent 22%),linear-gradient(180deg,#050c18,#07111f 55%,#081323)',color:'#fff',padding:'42px 0 78px'}}>
    <div style={{width:'min(1120px,92vw)',margin:'0 auto'}}>
      <Link href="/gospel/join" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>← Join YHVH GOSPEL TV</Link>
      <div style={{marginTop:24,color:'#83f0c4',fontWeight:900,fontSize:12,letterSpacing:'.14em'}}>OFFICIAL OPERATING POLICY · VERSION {charter.version}</div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(3rem,8vw,6.6rem)',lineHeight:.9,letterSpacing:'-.055em',margin:'12px 0 16px'}}>PARTNER &<br/><span style={{color:'#f5c451'}}>CONTRIBUTOR CHARTER.</span></h1>
      <p style={{fontSize:18,lineHeight:1.7,maxWidth:860,color:'#c7d4e4'}}>{charter.principle}</p>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,margin:'28px 0 34px'}}>
        {charter.partner_classes.map(p=><article key={p.id} style={{padding:18,border:'1px solid rgba(255,255,255,.12)',borderRadius:20,background:'rgba(255,255,255,.04)'}}><small style={{color:'#f5c451',fontWeight:900}}>PARTNER CLASS</small><h2 style={{fontSize:20,margin:'8px 0 5px'}}>{p.name}</h2><p style={{margin:0,color:'#94a7be',lineHeight:1.5,fontSize:13}}>{p.examples.join(' · ')}</p></article>)}
      </section>

      <section style={{display:'grid',gap:12}}>
        {charter.rules.map((r,i)=><article key={r.id} style={{display:'grid',gridTemplateColumns:'56px 1fr',gap:16,padding:20,border:'1px solid rgba(255,255,255,.1)',borderRadius:22,background:'rgba(8,21,38,.82)'}}>
          <div style={{width:46,height:46,borderRadius:999,display:'grid',placeItems:'center',background:'rgba(245,196,81,.1)',border:'1px solid rgba(245,196,81,.25)',color:'#f5c451',fontWeight:950}}>{String(i+1).padStart(2,'0')}</div>
          <div><h2 style={{fontFamily:'Georgia,serif',fontSize:24,margin:'2px 0 7px'}}>{r.title}</h2><p style={{margin:0,color:'#b5c3d5',lineHeight:1.6}}>{r.summary}</p></div>
        </article>)}
      </section>

      <section style={{marginTop:34,padding:26,borderRadius:26,border:'1px solid rgba(245,196,81,.2)',background:'linear-gradient(135deg,rgba(75,16,41,.5),rgba(9,25,43,.95))'}}>
        <small style={{color:'#f5c451',fontWeight:900,letterSpacing:'.12em'}}>ONBOARDING FLOW</small>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:15}}>{charter.onboarding.map((x,i)=><span key={x} style={{padding:'8px 11px',borderRadius:999,border:'1px solid rgba(255,255,255,.14)',background:'rgba(255,255,255,.04)',fontSize:12,fontWeight:800}}>{i+1}. {x.replaceAll('-',' ')}</span>)}</div>
        <p style={{margin:'18px 0 0',fontSize:13,color:'#97a9bf',lineHeight:1.55}}>{charter.legal_note}</p>
        <div style={{marginTop:18}}><Link href="/gospel/join" style={{display:'inline-block',padding:'12px 18px',borderRadius:999,background:'#f5c451',color:'#2d2108',fontWeight:950,textDecoration:'none'}}>Accept Charter & apply →</Link></div>
      </section>
    </div>
  </main>
}

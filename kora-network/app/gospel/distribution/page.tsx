import Link from 'next/link';

const lanes = [
  ['IZAKHONO Gospel TV','PRIMARY ORIGIN','Configured','Owned'],
  ['Vercel external distribution','WEB DISTRIBUTION','Configured','External'],
  ['GitHub Pages','PUBLIC FALLBACK','Configured','External'],
  ['YouTube Live','SIMULCAST','Credentials required','External'],
  ['Facebook Live','SIMULCAST','Credentials required','External'],
  ['Instagram','CLIPS / PROMOTION','Account integration required','External'],
  ['TikTok','CLIPS / LIVE WHERE SUPPORTED','Account integration required','External'],
  ['Smart TV / OTT','HLS / PARTNER DISTRIBUTION','Partner integration required','External'],
] as const;

export const metadata = {
  title: 'YHVH GOSPEL TV Distribution',
  description: 'YHVH GOSPEL TV distribution topology: IZAKHONO-owned origin with external reach and fallback lanes.'
};

export default function GospelDistributionMap() {
  return (
    <main id="main-content" style={{minHeight:'100vh',background:'#07111f',color:'#fff',padding:'56px 0 80px'}}>
      <div style={{width:'min(1120px,92vw)',margin:'0 auto'}}>
        <Link href="/gospel" style={{color:'#ffe29a',fontWeight:800,textDecoration:'none'}}>← YHVH GOSPEL TV</Link>
        <div style={{marginTop:20,fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#ffe29a'}}>HYBRID DISTRIBUTION MAP</div>
        <h1 style={{fontSize:'clamp(2.7rem,7vw,5.6rem)',lineHeight:.9,letterSpacing:'-.055em',margin:'12px 0 18px'}}>One master feed.<br/>Many roads out.</h1>
        <p style={{maxWidth:820,color:'#b8c5d8',lineHeight:1.65,fontSize:18}}>IZAKHONO remains authoritative. External services extend audience reach, resilience and discovery. A failure on an outside platform is treated as degraded distribution, not loss of the channel.</p>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14,marginTop:30}}>
          {lanes.map(([name,role,status,type]) => (
            <article key={name} style={{border:'1px solid rgba(255,255,255,.13)',borderRadius:20,padding:20,background:'rgba(255,255,255,.045)'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}>
                <small style={{fontWeight:900,letterSpacing:'.1em',color:type==='Owned'?'#7ff0bd':'#ffe29a'}}>{type.toUpperCase()}</small>
                <span style={{fontSize:11,padding:'5px 8px',borderRadius:999,background:status==='Configured'?'rgba(38,179,123,.16)':'rgba(245,196,81,.12)',color:status==='Configured'?'#93ffd0':'#ffe29a',fontWeight:800}}>{status}</span>
              </div>
              <h2 style={{margin:'12px 0 6px'}}>{name}</h2>
              <p style={{margin:0,color:'#9fb0c7',fontSize:14}}>{role}</p>
            </article>
          ))}
        </div>

        <section style={{marginTop:30,padding:24,border:'1px solid rgba(255,255,255,.13)',borderRadius:22,background:'linear-gradient(135deg,rgba(125,21,56,.32),rgba(95,58,168,.22))'}}>
          <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>SECURITY BOUNDARY</small>
          <h2>External credentials never belong in the public app.</h2>
          <p style={{color:'#c2cede',lineHeight:1.6,maxWidth:850}}>YouTube, Facebook and partner stream destinations are loaded only from the protected IZAKHONO host environment. The public YHVH GOSPEL TV site shows distribution state, not stream keys or private ingest URLs.</p>
        </section>
      </div>
    </main>
  );
}

import Link from 'next/link';

const regions = [
  ['Africa','Launch region','Johannesburg · Lagos · Nairobi'],
  ['Europe','Distribution-ready','London · Paris'],
  ['North America','Distribution-ready','New York · Chicago · Los Angeles'],
  ['Latin America & Caribbean','Distribution-ready','São Paulo · Mexico City'],
  ['Asia-Pacific','Distribution-ready','India · Singapore · Australia'],
  ['Middle East','Review-gated','Rights + regulatory review before targeted distribution'],
] as const;

const languages = ['English','French','Portuguese','Spanish','Swahili','isiZulu','isiXhosa','Arabic','Hindi','Indonesian','Simplified Chinese','Yoruba','Hausa'];

export const metadata = {
  title: 'YHVH GOSPEL TV Worldwide',
  description: 'Global YHVH GOSPEL TV distribution, languages and regional broadcast architecture.'
};

export default function WorldwideGospel() {
  return (
    <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 10% 0%,rgba(65,93,176,.24),transparent 30%),radial-gradient(circle at 95% 10%,rgba(245,196,81,.16),transparent 24%),#06101c',color:'#fff',padding:'54px 0 80px'}}>
      <div style={{width:'min(1160px,92vw)',margin:'0 auto'}}>
        <Link href="/gospel" style={{color:'#ffe29a',fontWeight:800,textDecoration:'none'}}>← YHVH GOSPEL TV</Link>
        <div style={{marginTop:20,fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#8ed8ff'}}>WORLDWIDE NETWORK</div>
        <h1 style={{fontSize:'clamp(3rem,8vw,7rem)',lineHeight:.87,letterSpacing:'-.06em',margin:'12px 0 18px'}}>AFRICA TO<br/><span style={{color:'#f5c451'}}>THE WORLD.</span></h1>
        <p style={{maxWidth:850,color:'#c4d0df',lineHeight:1.65,fontSize:18}}>One IZAKHONO-controlled Gospel network, distributed globally through regional time zones, multilingual versions, external video platforms, smart-TV/OTT partners and local ministry relationships.</p>

        <section style={{marginTop:34}}>
          <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>REGIONAL CLOCKS</small>
          <h2 style={{fontSize:'clamp(2rem,4vw,3.6rem)',margin:'8px 0 16px'}}>Programme for the viewer's day, not only ours.</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>
            {regions.map(([region,status,anchors]) => (
              <article key={region} style={{padding:20,borderRadius:20,border:'1px solid rgba(255,255,255,.13)',background:'rgba(255,255,255,.045)'}}>
                <span style={{fontSize:11,fontWeight:900,padding:'5px 8px',borderRadius:999,background:status==='Launch region'?'rgba(61,201,143,.16)':'rgba(245,196,81,.12)',color:status==='Launch region'?'#99ffd5':'#ffe29a'}}>{status}</span>
                <h3 style={{fontSize:24,margin:'12px 0 6px'}}>{region}</h3>
                <p style={{margin:0,color:'#9fb0c5',lineHeight:1.5}}>{anchors}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{marginTop:44,padding:26,borderRadius:24,border:'1px solid rgba(255,255,255,.13)',background:'linear-gradient(135deg,rgba(95,58,168,.28),rgba(125,21,56,.24))'}}>
          <small style={{color:'#ffe29a',fontWeight:900,letterSpacing:'.12em'}}>LANGUAGE ENGINE</small>
          <h2 style={{fontSize:'clamp(2rem,4vw,3.4rem)',margin:'8px 0 14px'}}>Hear the Gospel in the language you live in.</h2>
          <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
            {languages.map(language => <span key={language} style={{padding:'9px 12px',borderRadius:999,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',fontWeight:800}}>{language}</span>)}
          </div>
          <p style={{color:'#c2cede',lineHeight:1.6,margin:'18px 0 0'}}>Language versions will use approved dubbing and subtitles. Original attribution, testimony meaning, rights data and editorial approval remain intact across translations.</p>
        </section>

        <section style={{marginTop:44,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14}}>
          {[
            ['01','Global web','IZAKHONO + KORA + external web distribution'],
            ['02','Global social','Approved live simulcasts, trailers, clips and premieres'],
            ['03','Living room','Smart-TV, OTT and connected-TV distribution'],
            ['04','Local partnerships','Churches, Gospel artists, broadcasters and event partners'],
          ].map(([n,t,d]) => <article key={n} style={{padding:22,border:'1px solid rgba(255,255,255,.13)',borderRadius:20,background:'rgba(255,255,255,.045)'}}><b style={{fontSize:34,color:'#f5c451'}}>{n}</b><h3>{t}</h3><p style={{color:'#9fb0c5',lineHeight:1.55}}>{d}</p></article>)}
        </section>

        <section style={{marginTop:34,padding:24,borderRadius:22,border:'1px solid rgba(255,255,255,.13)',background:'rgba(9,22,39,.86)'}}>
          <small style={{color:'#8ed8ff',fontWeight:900,letterSpacing:'.12em'}}>GLOBAL RULE</small>
          <h2>Worldwide does not mean uncontrolled.</h2>
          <p style={{color:'#c2cede',lineHeight:1.65,maxWidth:900}}>Every territory is gated by content rights, local law, platform policy and distribution agreements. External platforms increase reach; they never take ownership of the master channel, editorial controls or IZAKHONO source-of-truth systems.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
            <Link href="/gospel/distribution" style={{padding:'12px 17px',borderRadius:999,background:'#f5c451',color:'#2d2108',fontWeight:900,textDecoration:'none'}}>View distribution map →</Link>
            <Link href="/gospel" style={{padding:'12px 17px',borderRadius:999,border:'1px solid rgba(255,255,255,.18)',color:'#fff',fontWeight:900,textDecoration:'none'}}>Back to Gospel TV</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

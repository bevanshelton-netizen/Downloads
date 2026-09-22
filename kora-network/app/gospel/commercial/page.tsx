import Link from 'next/link';
import CommercialLead from './commercial-client';

export const metadata={
  title:'Sponsor & Advertise — YHVH GOSPEL TV',
  description:'Commercial partnerships, sponsorship, event broadcast, distribution and production opportunities with YHVH GOSPEL TV.'
};

const offers=[
  {id:'founding-partner',title:'Founding / Presenting Partner',copy:'High-visibility channel association, launch campaigns and agreed brand inventory without editorial control.'},
  {id:'programme-sponsor',title:'Programme Sponsor',copy:'Sponsor suitable recurring Gospel programmes, segments or family-safe content lanes.'},
  {id:'event-broadcast',title:'Live Event Broadcast',copy:'Broadcast or simulcast Gospel concerts, conferences, worship events and revivals after technical and rights clearance.'},
  {id:'regional-distribution',title:'Regional Distribution',copy:'Work with YHVH GOSPEL TV on territory, platform, OTT, smart-TV and syndication distribution opportunities.'},
  {id:'advertising',title:'Faith-aligned Advertising',copy:'Brand messages and campaigns suitable for a Gospel and family audience, subject to approval.'},
  {id:'production-services',title:'Production Services',copy:'Remote production, recording, packaging, graphics, channel integration and event broadcast support.'}
];

export default function CommercialDesk(){
  const primaryUrl=process.env.KORA_GOSPEL_PRIMARY_URL||'https://gospel.domains.izakhonoafrica.co.za';
  const externalUrl=process.env.NEXT_PUBLIC_GOSPEL_EXTERNAL_INTAKE_URL||'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/kora-gospel-intake';
  return <main id="main-content" style={{minHeight:'100vh',background:'radial-gradient(circle at 12% 0%,rgba(125,21,56,.25),transparent 30%),radial-gradient(circle at 90% 0%,rgba(245,196,81,.17),transparent 27%),#06101c',color:'#fff',padding:'54px 0 80px'}}>
    <div style={{width:'min(1140px,92vw)',margin:'0 auto'}}>
      <Link href="/gospel" style={{color:'#ffe29a',fontWeight:900,textDecoration:'none'}}>← YHVH GOSPEL TV</Link>
      <div style={{marginTop:22,color:'#f5c451',fontWeight:900,fontSize:12,letterSpacing:'.14em'}}>GLOBAL COMMERCIAL DESK</div>
      <h1 style={{fontSize:'clamp(3rem,8vw,6.6rem)',lineHeight:.88,letterSpacing:'-.06em',margin:'12px 0 18px'}}>PARTNER WITH<br/><span style={{color:'#f5c451'}}>GOSPEL TV.</span></h1>
      <p style={{maxWidth:850,fontSize:18,lineHeight:1.65,color:'#c7d4e4'}}>Build reach around faith, Gospel music, family programming and live events through sponsorship, advertising, distribution and production partnerships. Pricing is proposal-based while we establish inventory, territory and delivery requirements.</p>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14,margin:'30px 0'}}>
        {offers.map(o=><article key={o.id} style={{padding:22,border:'1px solid rgba(255,255,255,.13)',borderRadius:22,background:'rgba(255,255,255,.045)'}}>
          <small style={{color:'#ffe29a',fontWeight:900}}>REQUEST A QUOTE</small><h2 style={{fontSize:21,margin:'8px 0'}}>{o.title}</h2><p style={{margin:0,color:'#aebed1',lineHeight:1.55}}>{o.copy}</p>
        </article>)}
      </section>

      <CommercialLead primaryUrl={primaryUrl} externalUrl={externalUrl}/>

      <section style={{marginTop:26,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14}}>
        <article style={{padding:20,borderRadius:20,background:'#0b1c31',border:'1px solid rgba(255,255,255,.12)'}}><b style={{color:'#83f0c4'}}>OWNED FIRST</b><p style={{color:'#aebed1',lineHeight:1.55}}>Commercial enquiries try the IZAKHONO-owned Gospel runtime first and use the external buffer only for resilience.</p></article>
        <article style={{padding:20,borderRadius:20,background:'#0b1c31',border:'1px solid rgba(255,255,255,.12)'}}><b style={{color:'#8ed8ff'}}>GLOBAL REACH</b><p style={{color:'#aebed1',lineHeight:1.55}}>Vercel and other approved external platforms expand discovery and distribution while IZAKHONO remains the authoritative control plane.</p></article>
        <article style={{padding:20,borderRadius:20,background:'#0b1c31',border:'1px solid rgba(255,255,255,.12)'}}><b style={{color:'#ffe29a'}}>EDITORIAL INDEPENDENCE</b><p style={{color:'#aebed1',lineHeight:1.55}}>Sponsorship and advertising never create automatic broadcast, ministry or editorial approval.</p></article>
      </section>
    </div>
  </main>;
}

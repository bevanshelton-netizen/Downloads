import Link from 'next/link';

export const metadata = {
  title: '90-Day Partnership Pilot | KORA',
  description: 'KORA strategic distribution and customer-acquisition pilot for authorised media partners.',
};

const card: React.CSSProperties = {
  padding: 24,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,.14)',
  background: 'rgba(255,255,255,.055)',
};

export default function PartnerPilotPage() {
  return (
    <main style={{minHeight:'100vh',background:'radial-gradient(circle at 15% 0%,#18345b 0,#08111f 38%,#050a12 100%)',color:'#fff'}}>
      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'76px 0 36px'}}>
        <div style={{display:'inline-flex',gap:10,alignItems:'center',padding:'8px 12px',border:'1px solid #f5c45166',borderRadius:999,color:'#f5c451',fontSize:12,fontWeight:900,letterSpacing:'.1em'}}>
          KORA COMMERCIAL PILOT • SOUTH AFRICA FIRST
        </div>
        <h1 style={{fontSize:'clamp(3.2rem,8vw,7.2rem)',lineHeight:.88,letterSpacing:'-.06em',margin:'18px 0 24px'}}>
          90 DAYS.<br/><span style={{color:'#f5c451'}}>MEASURABLE GROWTH.</span>
        </h1>
        <p style={{maxWidth:880,fontSize:20,lineHeight:1.65,color:'#c6d3e5'}}>
          KORA gives authorised media partners an additional African discovery and customer-acquisition channel without requiring them to surrender content ownership, DRM, subscriber authentication, territorial controls or the customer relationship.
        </p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:28}}>
          <Link href="/partner" style={{padding:'14px 20px',borderRadius:999,background:'#f5c451',color:'#211908',fontWeight:900,textDecoration:'none'}}>Partner control room →</Link>
          <Link href="/partners" style={{padding:'14px 20px',borderRadius:999,border:'1px solid #ffffff33',color:'#fff',fontWeight:800,textDecoration:'none'}}>Public partner gateway</Link>
        </div>
        <p style={{marginTop:18,color:'#8fa4bf',fontSize:13,maxWidth:780}}>
          Proposal status: prospective partnership framework only. KORA does not represent CANAL+, MultiChoice, DStv or any other prospective media organisation as a signed partner until an agreement is effective.
        </p>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'18px 0 52px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16}}>
        {[
          ['WATCH ON KORA','Direct playback only where KORA holds a current verified distribution or streaming right.'],
          ['INCLUDED WITH PARTNER','Approved subscriber authentication while the media partner keeps entitlement and rights control.'],
          ['OPEN IN PARTNER SERVICE','KORA records the authorised referral and hands the viewer to the partner application or website.'],
        ].map(([title,copy]) => <article key={title} style={card}><small style={{color:'#f5c451',fontWeight:900}}>{title}</small><p style={{fontSize:17,lineHeight:1.55,color:'#c6d3e5'}}>{copy}</p></article>)}
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'30px 0 60px'}}>
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.2fr) minmax(280px,.8fr)',gap:18}}>
          <article style={{...card,padding:30}}>
            <small style={{color:'#f5c451',fontWeight:900}}>COMMERCIAL STARTING POINT</small>
            <h2 style={{fontSize:'clamp(2rem,5vw,4rem)',letterSpacing:'-.04em',margin:'10px 0 18px'}}>Low-risk pilot. Clear economics.</h2>
            <div style={{display:'grid',gap:14,color:'#c6d3e5'}}>
              <p><strong style={{color:'#fff'}}>No upfront content licence guarantee.</strong> The first 90 days test incremental commercial value before long-term commitments.</p>
              <p><strong style={{color:'#fff'}}>Acquisition economics.</strong> KORA proposes either a fixed qualifying acquisition fee or approximately 10%–20% of the qualifying initial transaction.</p>
              <p><strong style={{color:'#fff'}}>Ongoing value economics.</strong> Where KORA continues to create measurable acquisition, retention or servicing value, the parties may negotiate approximately 3%–8% of attributable subscription revenue.</p>
              <p><strong style={{color:'#fff'}}>No automatic exclusivity.</strong> Any exclusivity requires a separate written agreement supported by appropriate commercial consideration.</p>
            </div>
          </article>

          <article style={{...card,padding:30,background:'linear-gradient(160deg,#f5c451 0%,#e6a934 100%)',color:'#1d170b'}}>
            <small style={{fontWeight:900}}>WHAT KORA MEASURES</small>
            <h2 style={{fontSize:'2.25rem',letterSpacing:'-.04em',margin:'10px 0 20px'}}>Evidence before expansion.</h2>
            {['Qualified referrals','Registrations','Paid conversions','Attributable revenue','Customer acquisition cost','Retention indicators','Campaign performance','Territory performance'].map(item => <div key={item} style={{padding:'11px 0',borderBottom:'1px solid rgba(29,23,11,.18)',fontWeight:800}}>{item}</div>)}
          </article>
        </div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'20px 0 64px'}}>
        <small style={{color:'#f5c451',fontWeight:900}}>90-DAY OPERATING RHYTHM</small>
        <h2 style={{fontSize:'clamp(2.3rem,5vw,4.7rem)',letterSpacing:'-.05em',margin:'10px 0 24px'}}>Launch. Learn. Expand.</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          {[
            ['DAY 0','Activate approved customer journey, attribution and partner campaign.'],
            ['DAY 30','Review traffic quality, conversion signal, technical friction and early economics.'],
            ['DAY 60','Optimise acquisition sources, offers, customer journey and integration depth.'],
            ['DAY 90','Decide: expand, extend, deepen integration, negotiate rights or conclude the pilot.'],
          ].map(([day,copy]) => <article key={day} style={card}><div style={{fontSize:34,fontWeight:950,color:'#f5c451'}}>{day}</div><p style={{color:'#c6d3e5',lineHeight:1.55}}>{copy}</p></article>)}
        </div>
      </section>

      <section style={{width:'min(1180px,92vw)',margin:'0 auto',padding:'12px 0 76px'}}>
        <article style={{...card,padding:32}}>
          <small style={{color:'#f5c451',fontWeight:900}}>RIGHTS & CONTROL</small>
          <h2 style={{fontSize:'clamp(2rem,4vw,3.5rem)',letterSpacing:'-.04em',margin:'10px 0 16px'}}>The partner stays in control.</h2>
          <p style={{maxWidth:920,color:'#c6d3e5',lineHeight:1.7}}>
            KORA will not copy, cache, rebroadcast or commercially distribute protected partner programming without the required written rights. The partner retains control of content ownership, streaming infrastructure, DRM, pricing, packages, territorial restrictions, subscriber authentication and customer accounts unless a later written agreement expressly changes that arrangement.
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:22}}>
            <Link href="/advertise" style={{padding:'13px 18px',borderRadius:999,background:'#fff',color:'#08111f',fontWeight:900,textDecoration:'none'}}>Open a partnership discussion →</Link>
            <Link href="/" style={{padding:'13px 18px',borderRadius:999,border:'1px solid #ffffff33',color:'#fff',fontWeight:800,textDecoration:'none'}}>Back to KORA</Link>
          </div>
        </article>
      </section>
    </main>
  );
}

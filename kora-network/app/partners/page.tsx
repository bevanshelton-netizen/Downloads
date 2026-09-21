import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  const { access } = await searchParams;
  let signedPartners: any[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('media_partners')
      .select('id,name,slug,integration_mode,territories')
      .eq('status','active')
      .eq('agreement_state','full')
      .order('name');
    signedPartners = data || [];
  } catch {}

  return (
    <main style={{minHeight:'100vh',background:'linear-gradient(180deg,#07111f,#101936)',color:'#fff'}}>
      <section style={{width:'min(1120px,92vw)',margin:'0 auto',padding:'72px 0 34px'}}>
        <div style={{fontWeight:900,letterSpacing:'.14em',fontSize:12,color:'#f5c451'}}>KORA PARTNER GATEWAY</div>
        <h1 style={{fontSize:'clamp(3rem,8vw,6.8rem)',lineHeight:.9,letterSpacing:'-.055em',margin:'14px 0'}}>DISCOVER HERE.<br/><span style={{color:'#f5c451'}}>WATCH WHERE AUTHORISED.</span></h1>
        <p style={{maxWidth:850,fontSize:18,lineHeight:1.65,color:'#c9d5e5'}}>KORA is operated by IZAKHONO AFRICA (PTY) LTD trading as KORA. We help audiences discover authorised entertainment while each media partner retains its content, streaming, authentication and rights controls.</p>
        {access ? <p style={{padding:14,border:'1px solid #f5c45155',borderRadius:16,color:'#ffe29a'}}>That title cannot be handed off through this route. KORA has kept the rights boundary closed.</p> : null}
      </section>

      <section style={{width:'min(1120px,92vw)',margin:'0 auto',padding:'10px 0 42px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16}}>
        {[
          ['WATCH ON KORA','Only where KORA has a current verified direct-playback grant.'],
          ['INCLUDED WITH PARTNER','Authenticated access only after the partner integration and rights are approved.'],
          ['OPEN WITH PARTNER','KORA records the referral and sends the viewer to the authorised provider.'],
        ].map(([title,copy])=><article key={title} style={{padding:24,border:'1px solid rgba(255,255,255,.14)',borderRadius:24,background:'rgba(255,255,255,.05)'}}><small style={{color:'#f5c451',fontWeight:900}}>{title}</small><p style={{color:'#c9d5e5',lineHeight:1.55}}>{copy}</p></article>)}
      </section>

      <section style={{width:'min(1120px,92vw)',margin:'0 auto',padding:'20px 0 72px'}}>
        <h2>Signed media partners</h2>
        {signedPartners.length ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14}}>{signedPartners.map(p=><article key={p.id} style={{padding:20,borderRadius:20,background:'#13223b'}}><strong>{p.name}</strong><p style={{color:'#b9c7da'}}>{String(p.integration_mode).replaceAll('_',' ')}</p></article>)}</div> : <p style={{color:'#b9c7da'}}>No prospective media house is represented here as a signed KORA partner before an agreement is effective.</p>}
        <div style={{marginTop:26}}><Link href="/advertise" style={{display:'inline-block',padding:'12px 18px',borderRadius:999,background:'#f5c451',color:'#221b08',fontWeight:900,textDecoration:'none'}}>Discuss a KORA partnership →</Link></div>
      </section>
    </main>
  );
}

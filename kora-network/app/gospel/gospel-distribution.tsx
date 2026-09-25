'use client';

import { useEffect, useState } from 'react';

type Props = { primaryUrl: string; pagesUrl: string };

export default function GospelDistribution({ primaryUrl, pagesUrl }: Props) {
  const [ownedStatus, setOwnedStatus] = useState<'checking'|'online'|'unreachable'>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    fetch(primaryUrl.replace(/\/$/,'') + '/health', {cache:'no-store', signal:controller.signal})
      .then(async (res) => {
        if (!res.ok) throw new Error('health');
        const body = await res.json();
        if (body?.ok !== true || body?.service !== 'kora-gospel-tv' || body?.runtime !== 'izakhono-owned') throw new Error('identity');
        setOwnedStatus('online');
      })
      .catch(() => setOwnedStatus('unreachable'))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [primaryUrl]);

  const badge = ownedStatus === 'online'
    ? 'IZAKHONO OWNED ORIGIN ONLINE'
    : ownedStatus === 'checking'
      ? 'CHECKING IZAKHONO ORIGIN…'
      : 'PUBLIC DELIVERY ONLINE · OWNED CUTOVER PENDING';

  const copy = ownedStatus === 'online'
    ? 'The watch gateway can route viewers to the independently verified IZAKHONO-owned Gospel runtime.'
    : 'YHVH Gospel TV remains publicly available through the verified external resilience route while the owned HTTPS origin completes cutover.';

  return (
    <section style={{height:'100%',padding:24,borderRadius:26,border:'1px solid rgba(255,255,255,.13)',background:'linear-gradient(145deg,rgba(10,23,43,.96),rgba(7,16,30,.98))',boxShadow:'0 20px 52px rgba(0,0,0,.2)'}}>
      <div style={{fontSize:11,fontWeight:950,letterSpacing:'.11em',color:ownedStatus==='online'?'#7ff0bd':'#ffe29a'}}>{badge}</div>
      <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(1.8rem,3vw,2.8rem)',lineHeight:1,margin:'14px 0 10px'}}>Watch without a dead end.</h2>
      <p style={{margin:'0 0 18px',color:'#aebcd0',lineHeight:1.58,fontSize:14}}>{copy}</p>
      <div style={{display:'grid',gap:9}}>
        <a href="/gospel/live" style={{padding:'13px 18px',borderRadius:999,background:'linear-gradient(135deg,#f5c451,#e59d1d)',color:'#2d2108',fontWeight:950,textDecoration:'none',textAlign:'center'}}>▶ Watch via smart gateway</a>
        {ownedStatus==='online' && <a href={primaryUrl} target="_blank" rel="noopener noreferrer" style={{padding:'11px 18px',borderRadius:999,border:'1px solid rgba(127,240,189,.3)',color:'#7ff0bd',fontWeight:900,textDecoration:'none',textAlign:'center'}}>Open IZAKHONO owned origin</a>}
        <a href={pagesUrl} target="_blank" rel="noopener noreferrer" style={{padding:'11px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.16)',color:'#fff',fontWeight:900,textDecoration:'none',textAlign:'center'}}>Open resilient public mirror</a>
        <button onClick={async()=>{try{if(navigator.share) await navigator.share({title:'YHVH GOSPEL TV',text:'Faith. Worship. Word. Africa to the World.',url:location.href}); else await navigator.clipboard.writeText(location.href)}catch{}}} style={{padding:'11px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.05)',color:'#fff',fontWeight:900,cursor:'pointer'}}>↗ Share YHVH Gospel TV</button>
      </div>
      <p style={{margin:'16px 0 0',color:'#7f90a7',lineHeight:1.45,fontSize:12}}>IZAKHONO remains the engine, editorial authority and primary infrastructure. External delivery is a replaceable resilience layer.</p>
    </section>
  );
}

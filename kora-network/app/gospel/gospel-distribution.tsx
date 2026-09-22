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
        if (body?.ok !== true || body?.service !== 'kora-gospel-tv') throw new Error('identity');
        setOwnedStatus('online');
      })
      .catch(() => setOwnedStatus('unreachable'))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [primaryUrl]);

  const badge = ownedStatus === 'online'
    ? 'OWNED ORIGIN ONLINE'
    : ownedStatus === 'checking'
      ? 'CHECKING OWNED ORIGIN…'
      : 'OWNED ORIGIN NOT YET PUBLIC';

  return (
    <div style={{marginTop:28,padding:22,borderRadius:24,border:'1px solid rgba(255,255,255,.14)',background:'rgba(10,23,43,.88)'}}>
      <div style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:ownedStatus==='online'?'#7ff0bd':'#ffe29a'}}>{badge}</div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
        <a href="/gospel/live" style={{padding:'12px 18px',borderRadius:999,background:'linear-gradient(135deg,#f5c451,#e59d1d)',color:'#2d2108',fontWeight:900,textDecoration:'none'}}>Watch via Hybrid Gateway →</a>
        <a href={primaryUrl} target="_blank" rel="noopener noreferrer" style={{padding:'12px 18px',borderRadius:999,border:'1px solid rgba(127,240,189,.3)',color:'#7ff0bd',fontWeight:900,textDecoration:'none'}}>Open IZAKHONO directly</a>
        <a href={pagesUrl} target="_blank" rel="noopener noreferrer" style={{padding:'12px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.18)',color:'#fff',fontWeight:900,textDecoration:'none'}}>Open public mirror</a>
        <button onClick={async()=>{try{if(navigator.share) await navigator.share({title:'KORA GOSPEL TV',text:'Faith. Worship. Word. Africa to the World.',url:location.href}); else await navigator.clipboard.writeText(location.href)}catch{}}} style={{padding:'12px 18px',borderRadius:999,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.06)',color:'#fff',fontWeight:900}}>↗ Share</button>
      </div>
      <p style={{margin:'14px 0 0',color:'#aebcd0',lineHeight:1.5,fontSize:14}}>The Hybrid Gateway prefers the IZAKHONO-owned origin when its health identity is verified. If the owned route is unavailable, viewers are sent to the external public mirror instead of a dead endpoint. External platforms remain reach and resilience layers, not the owner of the channel.</p>
    </div>
  );
}

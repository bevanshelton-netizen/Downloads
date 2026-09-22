import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ownedUrl = (process.env.KORA_GOSPEL_PRIMARY_URL || 'https://gospel.domains.izakhonoafrica.co.za').replace(/\/$/,'');
const fallbackUrl = process.env.KORA_GOSPEL_PAGES_URL || 'https://bevanshelton-netizen.github.io/Downloads/kora-gospel-tv/';

async function probeOwned(){
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try{
    const res = await fetch(ownedUrl + '/health', {cache:'no-store', signal:controller.signal});
    const body = await res.json().catch(()=>null);
    const ok = res.ok && body?.ok === true && body?.service === 'kora-gospel-tv' && body?.runtime === 'izakhono-owned';
    return {ok,status:res.status,latency_ms:Date.now()-started};
  }catch{
    return {ok:false,status:null,latency_ms:Date.now()-started};
  }finally{
    clearTimeout(timer);
  }
}

export async function GET(){
  const owned = await probeOwned();
  return NextResponse.json({
    ok:true,
    service:'kora-gospel-hybrid-gateway',
    authority:'IZAKHONO',
    routing_policy:'owned-first-external-fallback',
    selected_route:owned.ok?'izakhono-owned':'external-fallback',
    owned:{url:ownedUrl,reachable:owned.ok,status:owned.status,latency_ms:owned.latency_ms},
    external:{kora:true,public_mirror:fallbackUrl},
    generated_at:new Date().toISOString()
  },{
    headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}
  });
}

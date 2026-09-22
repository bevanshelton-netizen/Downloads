import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ownedUrl = (process.env.KORA_GOSPEL_PRIMARY_URL || 'https://gospel.domains.izakhonoafrica.co.za').replace(/\/$/,'');
const fallbackUrl = process.env.KORA_GOSPEL_PAGES_URL || 'https://bevanshelton-netizen.github.io/Downloads/yhvh-gospel-tv/';

async function ownedHealthy(){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try{
    const res = await fetch(ownedUrl + '/health', {cache:'no-store', signal:controller.signal});
    if(!res.ok) return false;
    const body = await res.json().catch(()=>null);
    return body?.ok === true && body?.service === 'kora-gospel-tv' && body?.runtime === 'izakhono-owned';
  }catch{
    return false;
  }finally{
    clearTimeout(timer);
  }
}

export async function GET(req:NextRequest){
  const route = await ownedHealthy();
  const destination = route ? ownedUrl : fallbackUrl;
  const response = NextResponse.redirect(destination, 307);
  response.headers.set('cache-control','no-store');
  response.headers.set('x-kora-gospel-route', route ? 'izakhono-owned' : 'external-fallback');
  response.headers.set('x-kora-gospel-authority','IZAKHONO');
  return response;
}

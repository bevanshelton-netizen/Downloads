import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ownedUrl = (
  process.env.YHVH_GOSPEL_PRIMARY_URL ||
  process.env.KORA_GOSPEL_PRIMARY_URL ||
  'https://gospel.domains.izakhonoafrica.co.za'
).replace(/\/$/,'');
const fallbackUrl =
  process.env.YHVH_GOSPEL_PAGES_URL ||
  process.env.KORA_GOSPEL_PAGES_URL ||
  'https://bevanshelton-netizen.github.io/Downloads/yhvh-gospel-tv/';
const rightsRegistryUrl =
  process.env.YHVH_RIGHTS_REGISTRY_URL ||
  'https://kora-network.vercel.app/gospel/rights-registry.json';
const acceptedOwnedServices = new Set(['yhvh-gospel-tv','kora-gospel-tv']);

async function ownedHealthy(){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try{
    const res = await fetch(ownedUrl + '/health', {cache:'no-store', signal:controller.signal});
    if(!res.ok) return false;
    const body = await res.json().catch(()=>null);
    return (
      body?.ok === true &&
      acceptedOwnedServices.has(String(body?.service||'')) &&
      body?.runtime === 'izakhono-owned'
    );
  }catch{
    return false;
  }finally{
    clearTimeout(timer);
  }
}

async function loadRights(){
  try{
    const res = await fetch(rightsRegistryUrl, {cache:'no-store'});
    if(!res.ok) return [];
    const body = await res.json().catch(()=>null);
    return Array.isArray(body?.territories) ? body.territories : [];
  }catch{
    return [];
  }
}

function normaliseTerritory(value:string|null){
  const territory = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(territory) ? territory : '';
}

function trustedTerritory(req:NextRequest){
  // Vercel's country header is trusted at the gateway. A fixed deployment
  // territory is supported for controlled/private deployments and testing.
  return normaliseTerritory(
    req.headers.get('x-vercel-ip-country') ||
    process.env.YHVH_DEFAULT_TERRITORY ||
    ''
  );
}

export async function GET(req:NextRequest){
  const territory = trustedTerritory(req);
  const contentId = req.nextUrl.searchParams.get('contentId') || 'YHVH-LIVE';
  const distributionMethod = req.nextUrl.searchParams.get('distributionMethod') || 'web';

  if(!territory){
    return NextResponse.json({
      ok:false,
      authority:'IZAKHONO',
      error:'territory_unresolved',
      status:'REVIEW_REQUIRED',
      message:'Live distribution is held until a trusted territory is available for rights verification.'
    },{
      status:451,
      headers:{
        'cache-control':'no-store',
        'x-yhvh-rights-decision':'REVIEW_REQUIRED',
        'x-yhvh-gospel-authority':'IZAKHONO'
      }
    });
  }

  const records = await loadRights();
  const record = records.find((item:any) =>
    String(item?.territory || '').toUpperCase() === territory &&
    String(item?.contentId || '') === contentId &&
    String(item?.distributionMethod || '') === distributionMethod
  );

  const now = new Date();
  const decision = !record
    ? {allowed:false,status:'REVIEW_REQUIRED',reason:'No verified rights record exists for this territory/content/distribution route.'}
    : record.validUntil && new Date(record.validUntil) <= now
      ? {allowed:false,status:'REVIEW_REQUIRED',reason:'The verified rights record has expired.'}
      : record.regulatoryReview && record.regulatoryReview !== 'CLEAR'
        ? {allowed:false,status:'REVIEW_REQUIRED',reason:'Regulatory review is not clear for this route.'}
        : record.status === 'CLEAR'
          ? {allowed:true,status:'CLEAR',reason:'Verified rights record permits this route.'}
          : {allowed:false,status:String(record.status || 'REVIEW_REQUIRED'),reason:'The verified rights record does not permit this route.'};

  if(!decision.allowed){
    return NextResponse.json({
      ok:false,
      authority:'IZAKHONO',
      territory,
      contentId,
      distributionMethod,
      decision
    },{
      status:451,
      headers:{
        'cache-control':'no-store',
        'x-yhvh-rights-decision':decision.status,
        'x-yhvh-gospel-authority':'IZAKHONO'
      }
    });
  }

  const owned = await ownedHealthy();
  const destination = owned ? ownedUrl : fallbackUrl;
  const response = NextResponse.redirect(destination, 307);
  response.headers.set('cache-control','no-store');
  response.headers.set('x-yhvh-gospel-route', owned ? 'izakhono-owned' : 'external-fallback');
  response.headers.set('x-yhvh-gospel-authority','IZAKHONO');
  response.headers.set('x-yhvh-rights-decision','CLEAR');
  response.headers.set('x-yhvh-territory',territory);
  // Transitional compatibility for older health tooling.
  response.headers.set('x-kora-gospel-route', owned ? 'izakhono-owned' : 'external-fallback');
  response.headers.set('x-kora-gospel-authority','IZAKHONO');
  return response;
}

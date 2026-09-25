import { getVercelOidcToken } from "@vercel/oidc";

export const OWNED_BRIDGE_URL=(process.env.GROWTH_OS_OWNED_BRIDGE_URL || "https://bridge.domains.izakhonoafrica.co.za").replace(/\/$/,"");

export function useOwnedBridge(){
  return Boolean(process.env.VERCEL);
}

export async function ownedBridgeRequest(path:string,init:RequestInit={}){
  const token=await getVercelOidcToken({
    audience:OWNED_BRIDGE_URL,
    project:"prj_OpMGIOe5TXhyhn6lHabQOOafRTV6",
    team:"team_XSHdQaQxmXGD1HlK2E4nehif"
  });
  if(!token) throw new Error("Vercel OIDC token unavailable.");
  const headers=new Headers(init.headers);
  headers.set("authorization",`Bearer ${token}`);
  if(init.body && !headers.has("content-type")) headers.set("content-type","application/json");
  return fetch(OWNED_BRIDGE_URL+path,{
    ...init,
    headers,
    cache:"no-store",
    signal:AbortSignal.timeout(12000)
  });
}

export async function ownedBridgeHealth(){
  try{
    const response=await fetch(OWNED_BRIDGE_URL+"/health",{cache:"no-store",signal:AbortSignal.timeout(5000)});
    const body=await response.json().catch(()=>({}));
    return {configured:true,reachable:response.ok,status:response.status,body};
  }catch{
    return {configured:true,reachable:false,status:null,body:{}};
  }
}

import { ownedBridgeHealth, ownedBridgeRequest, useOwnedBridge } from "@/lib/owned-bridge";

export type IzakhonoDataResult = {
  accepted:boolean;
  inserted?:number;
  duplicates?:number;
  error?:string;
};

function dataBase(){ return process.env.IZAKHONO_DATA_URL?.replace(/\/$/,""); }
function dataKey(){ return process.env.IZAKHONO_DATA_KEY; }

export function dataNodeReady(){
  return useOwnedBridge() || Boolean(dataBase() && dataKey());
}

async function dataNodeRequest(path:string,init:RequestInit={}){
  if(useOwnedBridge()) return ownedBridgeRequest("/v1/data"+path,init);
  const base=dataBase();
  const key=dataKey();
  if(!base || !key) throw new Error("IZAKHONO DATA NODE is not configured.");
  const headers=new Headers(init.headers);
  headers.set("x-izakhono-key",key);
  if(init.body && !headers.has("content-type")) headers.set("content-type","application/json");
  return fetch(base+path,{...init,headers,cache:"no-store",signal:AbortSignal.timeout(12000)});
}

export async function pushGrowthEvents(events:unknown[]):Promise<IzakhonoDataResult>{
  try{
    const response=await dataNodeRequest("/v1/events",{method:"POST",body:JSON.stringify(events)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) return {accepted:false,error:payload?.error || "IZAKHONO DATA NODE rejected the event batch."};
    return payload as IzakhonoDataResult;
  }catch(error){
    return {accepted:false,error:error instanceof Error?error.message:"IZAKHONO DATA NODE request failed."};
  }
}
export async function getGrowthStats(){
  const response=await dataNodeRequest("/v1/stats");
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload?.error || "Could not read Growth OS stats.");
  return payload;
}
export async function listGrowthApprovals(){
  const response=await dataNodeRequest("/v1/approvals");
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload?.error || "Could not read Growth OS approvals.");
  return payload;
}
export async function createGrowthApproval(input:{id?:string;actionType:string;provider?:string|null;externalAccountId?:string|null;campaignRef?:string|null;requestedPayload:unknown;}){
  const response=await dataNodeRequest("/v1/approvals",{method:"POST",body:JSON.stringify(input)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload?.error || "Could not create Growth OS approval.");
  return payload;
}
export async function decideGrowthApproval(id:string,input:{status:"approved"|"rejected"|"cancelled";note?:string|null;actorRef?:string|null;}){
  const response=await dataNodeRequest(`/v1/approvals/${encodeURIComponent(id)}/decision`,{method:"POST",body:JSON.stringify(input)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload?.error || "Could not decide Growth OS approval.");
  return payload;
}
export async function dataNodeHealth(){
  if(useOwnedBridge()){
    const b=await ownedBridgeHealth();
    const reachable=Boolean((b.body as any)?.modules?.data?.reachable && (b.body as any)?.modules?.data?.keyReady);
    return {configured:true,reachable,status:b.status};
  }
  const base=dataBase();
  if(!base) return {configured:false,reachable:false};
  try{
    const response=await fetch(base+"/health",{cache:"no-store",signal:AbortSignal.timeout(5000)});
    return {configured:true,reachable:response.ok,status:response.status};
  }catch{return {configured:true,reachable:false};}
}

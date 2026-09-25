import { cookies } from "next/headers";
import { ownedBridgeRequest, useOwnedBridge } from "@/lib/owned-bridge";

export const GROWTH_SESSION_COOKIE="growth_os_session";

type GrowthUser={
  id:string;
  email:string;
  displayName:string;
  status:string;
  mfaEnabled:boolean;
  roles:string[];
  permissions:string[];
};

function authBase(){
  return (process.env.IZAKHONO_AUTH_URL || "http://127.0.0.1:8820").replace(/\/$/,"");
}

export async function authNodeRequest(path:string,init:RequestInit={}){
  if(useOwnedBridge()){
    const headers=new Headers(init.headers);
    const authorization=headers.get("authorization");
    headers.delete("authorization");
    if(authorization?.startsWith("Bearer ")) headers.set("x-growth-session",authorization.slice(7));
    return ownedBridgeRequest("/v1/auth"+path,{...init,headers});
  }
  return fetch(authBase()+path,{
    ...init,
    cache:"no-store",
    signal:AbortSignal.timeout(10000)
  });
}

export async function getGrowthSession():Promise<{token:string;user:GrowthUser}|null>{
  const jar=await cookies();
  const token=jar.get(GROWTH_SESSION_COOKIE)?.value;
  if(!token) return null;
  try{
    const response=await authNodeRequest("/v1/me",{headers:{authorization:`Bearer ${token}`}});
    if(!response.ok) return null;
    const payload=await response.json() as {user?:GrowthUser};
    return payload.user?{token,user:payload.user}:null;
  }catch{
    return null;
  }
}

export function hasGrowthPermission(session:{user:GrowthUser}|null,permission:string){
  return Boolean(session?.user?.permissions?.includes(permission));
}

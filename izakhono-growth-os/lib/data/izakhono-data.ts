export type IzakhonoDataResult = {
  accepted:boolean;
  inserted?:number;
  duplicates?:number;
  error?:string;
};

export function dataNodeReady(){
  return Boolean(process.env.IZAKHONO_DATA_URL && process.env.IZAKHONO_DATA_KEY);
}

export async function pushGrowthEvents(events:unknown[]):Promise<IzakhonoDataResult>{
  const base=process.env.IZAKHONO_DATA_URL?.replace(/\/$/,"");
  const key=process.env.IZAKHONO_DATA_KEY;
  if(!base || !key){
    return {accepted:false,error:"IZAKHONO DATA NODE is not configured."};
  }

  const response=await fetch(base+"/v1/events",{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-izakhono-key":key
    },
    body:JSON.stringify(events),
    cache:"no-store",
    signal:AbortSignal.timeout(12000)
  });

  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    return {accepted:false,error:payload?.error || "IZAKHONO DATA NODE rejected the event batch."};
  }
  return payload as IzakhonoDataResult;
}

export async function dataNodeHealth(){
  const base=process.env.IZAKHONO_DATA_URL?.replace(/\/$/,"");
  if(!base) return {configured:false,reachable:false};
  try{
    const response=await fetch(base+"/health",{cache:"no-store",signal:AbortSignal.timeout(5000)});
    return {configured:true,reachable:response.ok,status:response.status};
  }catch{
    return {configured:true,reachable:false};
  }
}

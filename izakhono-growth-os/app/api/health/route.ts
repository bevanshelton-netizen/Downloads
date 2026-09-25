import { dataNodeHealth, dataNodeReady } from "@/lib/data/izakhono-data";

export async function GET(){
  const data=await dataNodeHealth();
  const externalResilience=Boolean(process.env.VERCEL);
  const backendReady=dataNodeReady()?data.reachable:true;
  const publicHealthy=externalResilience?true:backendReady;

  return Response.json({
    ok:publicHealthy,
    service:"growth-os-v2",
    product:"IZAKHONO GROWTH OS",
    version:"2.0",
    runtime:externalResilience?"external-resilience":"izakhono-owned",
    authority:"izakhono-owned-primary",
    status:backendReady?"healthy":"backend-degraded",
    backendReady,
    safeWriteMode:true,
    liveAdWrites:false,
    externalResilience,
    dataNode:{configured:dataNodeReady(),reachable:data.reachable}
  },{status:publicHealthy?200:503,headers:{"Cache-Control":"no-store"}});
}

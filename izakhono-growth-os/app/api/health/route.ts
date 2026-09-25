import { dataNodeHealth, dataNodeReady } from "@/lib/data/izakhono-data";

export async function GET(){
  const data=await dataNodeHealth();
  const healthy = dataNodeReady() ? data.reachable : true;
  const externalResilience = Boolean(process.env.VERCEL);

  return Response.json({
    ok:healthy,
    service:"growth-os-v2",
    product:"IZAKHONO GROWTH OS",
    version:"2.0",
    runtime:externalResilience?"external-resilience":"izakhono-owned",
    authority:"izakhono-owned-primary",
    safeWriteMode:true,
    liveAdWrites:false,
    externalResilience,
    dataNode:{
      configured:dataNodeReady(),
      reachable:data.reachable
    }
  },{
    status:healthy?200:503,
    headers:{"Cache-Control":"no-store"}
  });
}

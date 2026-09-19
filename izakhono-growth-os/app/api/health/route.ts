import { dataNodeHealth, dataNodeReady } from "@/lib/data/izakhono-data";

export async function GET(){
  const data=await dataNodeHealth();
  const healthy = dataNodeReady() ? data.reachable : true;

  return Response.json({
    ok:healthy,
    service:"growth-os-v2",
    product:"IZAKHONO GROWTH OS",
    version:"2.0",
    runtime:"izakhono-owned",
    safeWriteMode:true,
    liveAdWrites:false,
    dataNode:{
      configured:dataNodeReady(),
      reachable:data.reachable
    }
  },{
    status:healthy?200:503,
    headers:{"Cache-Control":"no-store"}
  });
}

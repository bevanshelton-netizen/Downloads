import { measurementSources } from "@/lib/measurement/registry";
import { dataNodeHealth, dataNodeReady } from "@/lib/data/izakhono-data";

export async function GET(){
  const sources=measurementSources.map(source=>{
    const presence=Object.fromEntries(source.env.map(name=>[name,Boolean(process.env[name])]));
    const missing=source.env.filter(name=>!process.env[name]);
    return {
      ...source,
      credentialsPresent:presence,
      missing,
      configured:missing.length===0
    };
  });

  const ownedData=await dataNodeHealth();

  return Response.json({
    sources,
    configured:sources.filter(source=>source.configured).length,
    total:sources.length,
    ingestSecretReady:Boolean(process.env.MEASUREMENT_INGEST_KEY),
    persistence:{
      provider:"IZAKHONO DATA NODE",
      configured:dataNodeReady(),
      reachable:ownedData.reachable,
      thirdPartyDatabaseRequired:false
    },
    optimizationGate:sources.some(source=>source.configured) && ownedData.reachable
      ? "Measurement and owned persistence are partly active. Keep auto-optimization off until real lead/revenue outcomes are reconciled."
      : "Owned persistence or live measurement sources are not fully configured yet."
  },{headers:{"Cache-Control":"no-store"}});
}

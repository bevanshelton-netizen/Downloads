import { measurementSources } from "@/lib/measurement/registry";

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

  return Response.json({
    sources,
    configured:sources.filter(source=>source.configured).length,
    total:sources.length,
    ingestSecretReady:Boolean(process.env.MEASUREMENT_INGEST_KEY),
    persistenceReady:Boolean(process.env.MEASUREMENT_DATABASE_URL),
    optimizationGate:sources.some(source=>source.configured)
      ? "Measurement sources are partially configured. Do not auto-optimize until revenue/lead outcomes are also mapped."
      : "No live measurement source is configured yet."
  },{headers:{"Cache-Control":"no-store"}});
}

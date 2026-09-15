import type { GrowthEvent, GrowthEventName } from "@/lib/measurement/types";

const allowed:GrowthEventName[]=[
  "page_view","lead","qualified_lead","application","enrolment","order","payment","refund"
];

function validEvent(value:unknown):value is GrowthEvent{
  if(!value || typeof value!=="object") return false;
  const event=value as Partial<GrowthEvent>;
  return Boolean(
    event.eventId &&
    event.eventName &&
    allowed.includes(event.eventName) &&
    event.occurredAt &&
    event.brand
  );
}

export async function POST(request:Request){
  const configuredKey=process.env.MEASUREMENT_INGEST_KEY;
  if(!configuredKey){
    return Response.json({
      accepted:false,
      code:"INGESTION_NOT_CONFIGURED",
      error:"Measurement ingestion is locked until MEASUREMENT_INGEST_KEY is configured."
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }

  const supplied=request.headers.get("x-growth-os-key");
  if(!supplied || supplied!==configuredKey){
    return Response.json({accepted:false,error:"Unauthorized"},{status:401});
  }

  const body=await request.json().catch(()=>null);
  const events:Array<GrowthEvent>=Array.isArray(body)?body:[body];
  if(events.length===0 || events.length>100 || !events.every(validEvent)){
    return Response.json({
      accepted:false,
      error:"Invalid Growth OS event payload.",
      allowedEvents:allowed,
      maxBatch:100
    },{status:400});
  }

  if(!process.env.MEASUREMENT_DATABASE_URL){
    return Response.json({
      accepted:false,
      code:"PERSISTENCE_NOT_CONFIGURED",
      validated:events.length,
      error:"Events passed validation, but persistence is intentionally locked until MEASUREMENT_DATABASE_URL is configured."
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }

  return Response.json({
    accepted:false,
    code:"PERSISTENCE_ADAPTER_PENDING",
    validated:events.length,
    error:"Database credentials exist, but the persistence adapter has not yet been activated."
  },{status:503,headers:{"Cache-Control":"no-store"}});
}

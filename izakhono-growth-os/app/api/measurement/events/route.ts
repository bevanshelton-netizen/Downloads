import { pushGrowthEvents } from "@/lib/data/izakhono-data";

type GrowthEventName =
  | "page_view"
  | "lead"
  | "qualified_lead"
  | "application"
  | "enrolment"
  | "order"
  | "payment"
  | "refund";

type GrowthEvent = {
  eventId:string;
  eventName:GrowthEventName;
  occurredAt:string;
  brand:string;
  source?:string;
  medium?:string;
  campaign?:string;
  country?:string;
  language?:string;
  landingPage?:string;
  leadId?:string;
  customerId?:string;
  orderId?:string;
  value?:number;
  currency?:string;
  metadata?:Record<string,string|number|boolean|null>;
};

const allowed:GrowthEventName[]=[
  "page_view","lead","qualified_lead","application","enrolment","order","payment","refund"
];

function validEvent(value:unknown):value is GrowthEvent{
  if(!value || typeof value!=="object") return false;
  const event=value as Partial<GrowthEvent>;
  return Boolean(event.eventId && event.eventName && allowed.includes(event.eventName) && event.occurredAt && event.brand);
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

  const persisted=await pushGrowthEvents(events);
  if(!persisted.accepted){
    return Response.json({
      accepted:false,
      code:"OWNED_DATA_NODE_UNAVAILABLE",
      validated:events.length,
      error:persisted.error
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }

  return Response.json({
    accepted:true,
    storage:"IZAKHONO DATA NODE",
    validated:events.length,
    inserted:persisted.inserted||0,
    duplicates:persisted.duplicates||0
  },{status:202,headers:{"Cache-Control":"no-store"}});
}

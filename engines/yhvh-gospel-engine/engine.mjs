import { createServer } from "node:http";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8892);
const ROOT=resolve(fileURLToPath(new URL("./",import.meta.url)));
const DATA_DIR=process.env.YHVH_GOSPEL_ENGINE_DATA_DIR||"/var/lib/izakhono-runtime/data/yhvh-gospel-engine";
const SCHEDULE_FILE=process.env.YHVH_GOSPEL_ENGINE_SCHEDULE||resolve(ROOT,"schedule.json");
const STATE_FILE=resolve(DATA_DIR,"state.json");
const EVENT_LOG=resolve(DATA_DIR,"events.ndjson");
const TOKEN=String(process.env.YHVH_GOSPEL_ENGINE_TOKEN||"").trim();
const TIMEZONE=process.env.YHVH_GOSPEL_ENGINE_TIMEZONE||"Africa/Johannesburg";

function json(res,status,obj,extra={}){
  const body=Buffer.from(JSON.stringify(obj));
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":body.length,
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    ...extra
  });
  res.end(body);
}
function clean(v,max=160){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function timingSafeToken(req){
  if(TOKEN.length<24) return false;
  const header=String(req.headers.authorization||"");
  if(!header.startsWith("Bearer ")) return false;
  const supplied=Buffer.from(header.slice(7).trim());
  const expected=Buffer.from(TOKEN);
  return supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);
}
async function readJson(req,limit=16_000){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error("payload_too_large");chunks.push(chunk)}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
async function loadSchedule(){
  const data=JSON.parse(await readFile(SCHEDULE_FILE,"utf8"));
  if(!Array.isArray(data.slots)||!data.slots.length) throw new Error("schedule_empty");
  return data;
}
async function loadState(){
  try{return JSON.parse(await readFile(STATE_FILE,"utf8"))}
  catch{return {live_override:null,ingest:{healthy:false,last_heartbeat:null,label:""},updated_at:null}}
}
async function saveState(state,event){
  await mkdir(DATA_DIR,{recursive:true});
  state.updated_at=new Date().toISOString();
  await writeFile(STATE_FILE,JSON.stringify(state,null,2)+"\n",{encoding:"utf8",mode:0o600});
  if(event) await appendFile(EVENT_LOG,JSON.stringify({at:state.updated_at,...event})+"\n",{encoding:"utf8",mode:0o600});
}
function partsInZone(date,tz){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(date);
  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {hour:Number(obj.hour),minute:Number(obj.minute),second:Number(obj.second)};
}
function minuteOfDay(date,tz){const p=partsInZone(date,tz);return p.hour*60+p.minute+p.second/60}
function slotStart(slot){const [h,m]=String(slot.start).split(":").map(Number);return h*60+m}
function resolveClock(schedule,now=new Date()){
  const minute=minuteOfDay(now,schedule.timezone||TIMEZONE);
  const normalized=schedule.slots.map((s,i)=>({...s,index:i,start_min:slotStart(s)})).sort((a,b)=>a.start_min-b.start_min);
  let current=normalized[normalized.length-1];
  for(const slot of normalized){if(minute>=slot.start_min)current=slot;else break}
  const next=normalized[(current.index+1)%normalized.length]||normalized[0];
  const elapsed=current.start_min<=minute?minute-current.start_min:(1440-current.start_min)+minute;
  const duration=Number(current.duration_min||60);
  return {
    current:{title:current.title,genre:current.genre,start:current.start,duration_min:duration,elapsed_min:Math.max(0,Math.floor(elapsed)),remaining_min:Math.max(0,Math.ceil(duration-elapsed))},
    next:{title:next.title,genre:next.genre,start:next.start,duration_min:Number(next.duration_min||60)}
  };
}
function adapters(){
  const names=["youtube","facebook","smart-tv","ott-partner","social-clips"];
  return names.map(id=>({id,enabled:String(process.env["YHVH_ADAPTER_"+id.toUpperCase().replaceAll("-","_")]||"0")==="1",role:"replaceable-external-distribution"}));
}
async function publicState(){
  const [schedule,state]=await Promise.all([loadSchedule(),loadState()]);
  const clock=resolveClock(schedule);
  const live=state.live_override&&state.live_override.active===true?state.live_override:null;
  return {
    authority:"IZAKHONO",
    engine:"YHVH GOSPEL ENGINE",
    mode:live?"live-override":"scheduled",
    programme:live?{current:{title:live.label||"Live Gospel Broadcast",genre:"live",start:"LIVE",duration_min:null,elapsed_min:null,remaining_min:null},next:clock.next}:clock,
    ingest:state.ingest,
    schedule:{timezone:schedule.timezone||TIMEZONE,revision:schedule.revision||"unknown"},
    adapters:adapters(),
    generated_at:new Date().toISOString()
  };
}

createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  if(req.method==="GET"&&url.pathname==="/health"){
    let schedule_ok=true;
    try{await loadSchedule()}catch{schedule_ok=false}
    return json(res,schedule_ok?200:503,{ok:schedule_ok,service:"yhvh-gospel-engine",runtime:"izakhono-owned",authority:"IZAKHONO",version:"1.0.0",schedule_ok});
  }
  if(req.method==="GET"&&url.pathname==="/v1/state") return json(res,200,await publicState());
  if(req.method==="GET"&&url.pathname==="/v1/schedule"){
    const schedule=await loadSchedule();
    return json(res,200,{authority:"IZAKHONO",...schedule});
  }
  if(req.method==="GET"&&url.pathname==="/v1/adapters") return json(res,200,{authority:"IZAKHONO",adapters:adapters()});

  if(req.method==="POST"&&url.pathname==="/v1/live"){
    if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
    try{
      const body=await readJson(req);
      const state=await loadState();
      if(body.active===false){
        state.live_override=null;
        await saveState(state,{type:"live-override-stopped"});
        return json(res,200,{ok:true,mode:"scheduled"});
      }
      state.live_override={active:true,label:clean(body.label||"Live Gospel Broadcast",120),source:clean(body.source||"studio",80),started_at:new Date().toISOString()};
      await saveState(state,{type:"live-override-started",label:state.live_override.label,source:state.live_override.source});
      return json(res,200,{ok:true,mode:"live-override",live:state.live_override});
    }catch(err){return json(res,400,{error:String(err?.message||"Invalid live override request.")})}
  }

  if(req.method==="POST"&&url.pathname==="/v1/heartbeat"){
    if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
    try{
      const body=await readJson(req);
      const state=await loadState();
      state.ingest={healthy:body.healthy!==false,last_heartbeat:new Date().toISOString(),label:clean(body.label||"master-ingest",80)};
      await saveState(state,{type:"ingest-heartbeat",healthy:state.ingest.healthy,label:state.ingest.label});
      return json(res,200,{ok:true,ingest:state.ingest});
    }catch(err){return json(res,400,{error:String(err?.message||"Invalid heartbeat.")})}
  }

  return json(res,404,{error:"Not found"});
}).listen(PORT,HOST,()=>console.log(`YHVH GOSPEL ENGINE listening on http://${HOST}:${PORT}`));

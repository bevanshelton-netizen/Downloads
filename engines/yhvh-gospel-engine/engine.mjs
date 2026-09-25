import { createServer } from "node:http";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8892);
const ROOT=resolve(fileURLToPath(new URL("./",import.meta.url)));
const DATA_DIR=process.env.YHVH_GOSPEL_ENGINE_DATA_DIR||"/var/lib/izakhono-runtime/data/yhvh-gospel-engine";
const BUNDLED_SCHEDULE=process.env.YHVH_GOSPEL_ENGINE_SCHEDULE||resolve(ROOT,"schedule.json");
const SCHEDULE_FILE=resolve(DATA_DIR,"schedule.json");
const CATALOGUE_FILE=resolve(DATA_DIR,"catalogue.json");
const STATE_FILE=resolve(DATA_DIR,"state.json");
const EVENT_LOG=resolve(DATA_DIR,"events.ndjson");
const SUBMISSION_LOG=resolve(DATA_DIR,"submissions.ndjson");
const TOKEN=String(process.env.YHVH_GOSPEL_ENGINE_TOKEN||"").trim();
const TIMEZONE=process.env.YHVH_GOSPEL_ENGINE_TIMEZONE||"Africa/Johannesburg";
const VERSION="2.0.0";

const PRIVACY=Object.freeze({
  behavioural_tracking:false,
  profiling:false,
  silent_analytics:false,
  advertising_identifiers:false,
  operational_audit_only:true
});

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
function clean(v,max=160){
  return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}
function cleanObject(v,maxEntries=20){
  if(!v||typeof v!=="object"||Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).slice(0,maxEntries).map(([k,val])=>[clean(k,60),clean(val,300)]));
}
function timingSafeToken(req){
  if(TOKEN.length<24) return false;
  const header=String(req.headers.authorization||"");
  if(!header.startsWith("Bearer ")) return false;
  const supplied=Buffer.from(header.slice(7).trim());
  const expected=Buffer.from(TOKEN);
  return supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);
}
async function readJson(req,limit=32_000){
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>limit) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
async function ensureData(){
  await mkdir(DATA_DIR,{recursive:true});
}
async function readJsonFile(path,fallback){
  try{return JSON.parse(await readFile(path,"utf8"))}catch{return fallback}
}
async function appendEvent(type,details={}){
  await ensureData();
  await appendFile(EVENT_LOG,JSON.stringify({at:new Date().toISOString(),type,...details})+"\n",{encoding:"utf8",mode:0o600});
}
async function loadSchedule(){
  const persisted=await readJsonFile(SCHEDULE_FILE,null);
  const data=persisted||JSON.parse(await readFile(BUNDLED_SCHEDULE,"utf8"));
  validateSchedule(data);
  return data;
}
function validateSchedule(data){
  if(!data||!Array.isArray(data.slots)||!data.slots.length) throw new Error("schedule_empty");
  for(const slot of data.slots){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(slot.start||""))) throw new Error("schedule_invalid_start");
    if(!clean(slot.title,120)) throw new Error("schedule_title_required");
    const duration=Number(slot.duration_min||0);
    if(!Number.isFinite(duration)||duration<=0||duration>1440) throw new Error("schedule_invalid_duration");
  }
}
async function saveSchedule(data){
  validateSchedule(data);
  await ensureData();
  const out={
    schema:"yhvh.gospel.engine.schedule/v2",
    timezone:clean(data.timezone||TIMEZONE,80),
    revision:clean(data.revision||("manual-"+new Date().toISOString()),100),
    slots:data.slots.map(s=>({
      start:String(s.start),
      duration_min:Number(s.duration_min),
      title:clean(s.title,120),
      genre:clean(s.genre||"gospel",60)
    }))
  };
  await writeFile(SCHEDULE_FILE,JSON.stringify(out,null,2)+"\n",{encoding:"utf8",mode:0o600});
  await appendEvent("schedule-updated",{revision:out.revision,slots:out.slots.length});
  return out;
}
async function loadState(){
  return await readJsonFile(STATE_FILE,{
    live_override:null,
    ingest:{healthy:false,last_heartbeat:null,label:""},
    simulcast:{healthy:false,last_heartbeat:null,targets:[],label:""},
    updated_at:null
  });
}
async function saveState(state,event){
  await ensureData();
  state.updated_at=new Date().toISOString();
  await writeFile(STATE_FILE,JSON.stringify(state,null,2)+"\n",{encoding:"utf8",mode:0o600});
  if(event) await appendEvent(event.type,event.details||{});
}
async function loadCatalogue(){
  return await readJsonFile(CATALOGUE_FILE,{
    schema:"yhvh.gospel.engine.catalogue/v1",
    revision:"empty",
    items:[]
  });
}
async function saveCatalogue(input){
  const items=Array.isArray(input.items)?input.items:[];
  if(items.length>5000) throw new Error("catalogue_too_large");
  const out={
    schema:"yhvh.gospel.engine.catalogue/v1",
    revision:clean(input.revision||("manual-"+new Date().toISOString()),100),
    items:items.map((item,index)=>({
      id:clean(item.id||("item-"+String(index+1).padStart(4,"0")),80),
      title:clean(item.title,180),
      type:clean(item.type||"programme",60),
      language:clean(item.language||"English",60),
      territory:clean(item.territory||"Global",80),
      duration_sec:Math.max(0,Number(item.duration_sec||0)),
      rights_status:clean(item.rights_status||"review-required",60),
      source:clean(item.source||"IZAKHONO",100),
      metadata:cleanObject(item.metadata)
    })).filter(x=>x.title)
  };
  await ensureData();
  await writeFile(CATALOGUE_FILE,JSON.stringify(out,null,2)+"\n",{encoding:"utf8",mode:0o600});
  await appendEvent("catalogue-updated",{revision:out.revision,items:out.items.length});
  return out;
}
async function saveSubmission(data){
  await ensureData();
  const category=clean(data.category,30);
  if(!["content","partner","prayer"].includes(category)) throw new Error("invalid_category");
  if(category!=="prayer"&&(!clean(data.name,120)||!clean(data.contact,160))) throw new Error("name_contact_required");
  if(!clean(data.message,1600)) throw new Error("message_required");
  const reference="YHVH-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomBytes(4).toString("hex").toUpperCase();
  const record={
    schema:"yhvh.gospel.engine.submission/v1",
    reference,
    created_at:new Date().toISOString(),
    category,
    type:clean(data.type,60),
    name:clean(data.name,120),
    contact:clean(data.contact,160),
    message:clean(data.message,1600),
    on_air:Boolean(data.onAir),
    territory:clean(data.territory,80),
    language:clean(data.language,60),
    rights_attested:Boolean(data.rightsAttested),
    source_channel:clean(data.sourceChannel||"yhvh-owned",80),
    details:cleanObject(data.details)
  };
  await appendFile(SUBMISSION_LOG,JSON.stringify(record)+"\n",{encoding:"utf8",mode:0o600});
  await appendEvent("submission-received",{reference,category});
  return record;
}
async function readSubmissions(limit=100){
  try{
    const raw=await readFile(SUBMISSION_LOG,"utf8");
    return raw.trim().split("\n").filter(Boolean).slice(-Math.max(1,Math.min(Number(limit)||100,200))).reverse()
      .map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  }catch{return []}
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
  const normalized=schedule.slots.map(s=>({...s,start_min:slotStart(s)})).sort((a,b)=>a.start_min-b.start_min);
  let index=normalized.length-1;
  for(let i=0;i<normalized.length;i++){if(minute>=normalized[i].start_min) index=i; else break}
  const current=normalized[index];
  const next=normalized[(index+1)%normalized.length];
  const elapsed=current.start_min<=minute?minute-current.start_min:(1440-current.start_min)+minute;
  const duration=Number(current.duration_min||60);
  return {
    current:{title:current.title,genre:current.genre,start:current.start,duration_min:duration,elapsed_min:Math.max(0,Math.floor(elapsed)),remaining_min:Math.max(0,Math.ceil(duration-elapsed))},
    next:{title:next.title,genre:next.genre,start:next.start,duration_min:Number(next.duration_min||60)}
  };
}
function adapters(){
  const names=["youtube","facebook","smart-tv","ott-partner","social-clips"];
  return names.map(id=>({
    id,
    enabled:String(process.env["YHVH_ADAPTER_"+id.toUpperCase().replaceAll("-","_")]||"0")==="1",
    role:"replaceable-external-distribution",
    authoritative:false
  }));
}
async function capabilities(){
  return {
    authority:"IZAKHONO",
    engine:"YHVH GOSPEL ENGINE",
    version:VERSION,
    independent_engine:true,
    owns:["catalogue","scheduling","live-control","content-submissions","simulcast-state","health-verification","provider-adapters"],
    external_provider_policy:"replaceable-adapters-only",
    privacy:PRIVACY
  };
}
async function publicState(){
  const [schedule,state,catalogue]=await Promise.all([loadSchedule(),loadState(),loadCatalogue()]);
  const clock=resolveClock(schedule);
  const live=state.live_override&&state.live_override.active===true?state.live_override:null;
  return {
    authority:"IZAKHONO",
    engine:"YHVH GOSPEL ENGINE",
    version:VERSION,
    independent_engine:true,
    mode:live?"live-override":"scheduled",
    programme:live?{
      current:{title:live.label||"Live Gospel Broadcast",genre:"live",start:"LIVE",duration_min:null,elapsed_min:null,remaining_min:null},
      next:clock.next
    }:clock,
    ingest:state.ingest,
    simulcast:state.simulcast,
    catalogue:{revision:catalogue.revision||"unknown",items:Array.isArray(catalogue.items)?catalogue.items.length:0},
    schedule:{timezone:schedule.timezone||TIMEZONE,revision:schedule.revision||"unknown",slots:schedule.slots.length},
    adapters:adapters(),
    privacy:PRIVACY,
    generated_at:new Date().toISOString()
  };
}

createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  try{
    if(req.method==="GET"&&url.pathname==="/health"){
      let schedule_ok=true,catalogue_ok=true,storage_ok=true;
      try{await loadSchedule()}catch{schedule_ok=false}
      try{await loadCatalogue()}catch{catalogue_ok=false}
      try{await ensureData()}catch{storage_ok=false}
      const ok=schedule_ok&&catalogue_ok&&storage_ok;
      return json(res,ok?200:503,{
        ok,
        service:"yhvh-gospel-engine",
        runtime:"izakhono-owned",
        authority:"IZAKHONO",
        version:VERSION,
        independent_engine:true,
        components:{schedule:schedule_ok,catalogue:catalogue_ok,storage:storage_ok},
        privacy:PRIVACY
      });
    }
    if(req.method==="GET"&&url.pathname==="/v1/capabilities") return json(res,200,await capabilities());
    if(req.method==="GET"&&url.pathname==="/v1/state") return json(res,200,await publicState());
    if(req.method==="GET"&&url.pathname==="/v1/schedule") return json(res,200,{authority:"IZAKHONO",...(await loadSchedule())});
    if(req.method==="GET"&&url.pathname==="/v1/catalogue") return json(res,200,{authority:"IZAKHONO",...(await loadCatalogue())});
    if(req.method==="GET"&&url.pathname==="/v1/adapters") return json(res,200,{authority:"IZAKHONO",adapters:adapters()});
    if(req.method==="GET"&&url.pathname==="/v1/simulcast"){
      const state=await loadState();
      return json(res,200,{authority:"IZAKHONO",simulcast:state.simulcast,adapters:adapters()});
    }

    if(req.method==="POST"&&url.pathname==="/v1/submissions"){
      try{
        const record=await saveSubmission(await readJson(req));
        return json(res,201,{ok:true,reference:record.reference,route:"yhvh-owned-engine",authoritative:true});
      }catch(err){
        const code=String(err?.message||"");
        if(code==="payload_too_large") return json(res,413,{error:"Submission is too large."});
        return json(res,400,{error:code||"Invalid submission."});
      }
    }

    if(req.method==="GET"&&url.pathname==="/v1/submissions"){
      if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
      return json(res,200,{ok:true,records:await readSubmissions(url.searchParams.get("limit")||100)});
    }

    if(req.method==="PUT"&&url.pathname==="/v1/schedule"){
      if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
      try{return json(res,200,{ok:true,schedule:await saveSchedule(await readJson(req,128_000))})}
      catch(err){return json(res,400,{error:String(err?.message||"Invalid schedule.")})}
    }

    if(req.method==="PUT"&&url.pathname==="/v1/catalogue"){
      if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
      try{return json(res,200,{ok:true,catalogue:await saveCatalogue(await readJson(req,2_000_000))})}
      catch(err){return json(res,400,{error:String(err?.message||"Invalid catalogue.")})}
    }

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
        state.live_override={
          active:true,
          label:clean(body.label||"Live Gospel Broadcast",120),
          source:clean(body.source||"studio",80),
          started_at:new Date().toISOString()
        };
        await saveState(state,{type:"live-override-started",details:{label:state.live_override.label,source:state.live_override.source}});
        return json(res,200,{ok:true,mode:"live-override",live:state.live_override});
      }catch(err){return json(res,400,{error:String(err?.message||"Invalid live override request.")})}
    }

    if(req.method==="POST"&&url.pathname==="/v1/heartbeat"){
      if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
      try{
        const body=await readJson(req);
        const state=await loadState();
        state.ingest={healthy:body.healthy!==false,last_heartbeat:new Date().toISOString(),label:clean(body.label||"master-ingest",80)};
        await saveState(state,{type:"ingest-heartbeat",details:{healthy:state.ingest.healthy,label:state.ingest.label}});
        return json(res,200,{ok:true,ingest:state.ingest});
      }catch(err){return json(res,400,{error:String(err?.message||"Invalid heartbeat.")})}
    }

    if(req.method==="POST"&&url.pathname==="/v1/simulcast/heartbeat"){
      if(!timingSafeToken(req)) return json(res,401,{error:"Owner engine authorization required."},{"www-authenticate":"Bearer"});
      try{
        const body=await readJson(req);
        const state=await loadState();
        const targets=Array.isArray(body.targets)?body.targets.slice(0,25).map(v=>clean(v,80)).filter(Boolean):[];
        state.simulcast={
          healthy:body.healthy!==false,
          last_heartbeat:new Date().toISOString(),
          label:clean(body.label||"simulcast",80),
          targets
        };
        await saveState(state,{type:"simulcast-heartbeat",details:{healthy:state.simulcast.healthy,targets:state.simulcast.targets}});
        return json(res,200,{ok:true,simulcast:state.simulcast});
      }catch(err){return json(res,400,{error:String(err?.message||"Invalid simulcast heartbeat.")})}
    }

    return json(res,404,{error:"Not found"});
  }catch(err){
    return json(res,500,{error:"Engine request failed.",code:clean(err?.message||"engine_error",100)});
  }
}).listen(PORT,HOST,()=>console.log(`YHVH GOSPEL ENGINE v${VERSION} listening on http://${HOST}:${PORT}`));

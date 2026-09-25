import { createServer } from "node:http";
import { readFile, stat, mkdir, appendFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));
const DATA_DIR = process.env.GOSPEL_TV_DATA_DIR || "/var/lib/izakhono-runtime/data/kora-gospel-tv";
const LIVE_EMBED_URL = process.env.GOSPEL_TV_LIVE_EMBED_URL || "";
const CONTROL_TOKEN = String(process.env.GOSPEL_TV_CONTROL_TOKEN || "").trim();
const RECONCILE_RECEIPT = process.env.GOSPEL_RECONCILE_RECEIPT || "/var/lib/izakhono-deploy/kora-gospel-reconcile.json";
const DEPLOYMENT_RECEIPT = process.env.YHVH_DEPLOYMENT_RECEIPT || "/var/lib/izakhono-deploy/kora-gospel-tv.json";
const OWNER_AGENT_PROOF = process.env.YHVH_OWNER_AGENT_PROOF || "/var/lib/izakhono-deploy/yhvh-owner-agent-proof.json";
const ENGINE_URL = String(process.env.YHVH_GOSPEL_ENGINE_URL || "http://127.0.0.1:8892").replace(/\/$/,"");
const ENGINE_TOKEN = String(process.env.YHVH_GOSPEL_ENGINE_TOKEN || "").trim();
const PUBLIC_INTAKE_ORIGINS = new Set([
  "https://kora-network.vercel.app",
  "https://bevanshelton-netizen.github.io",
  "https://gospel.domains.izakhonoafrica.co.za",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

const types = {
  ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".mp4":"video/mp4"
};

const rate = new Map();
function baseHeaders(type,length,cache="no-store"){
  return {
    "content-type":type,
    "content-length":length,
    "cache-control":cache,
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=()",
    "x-frame-options":"SAMEORIGIN",
    "content-security-policy":"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://yfawrenhudjomhnglfhq.supabase.co; frame-src https:; media-src 'self' https: blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
  };
}
function send(res,status,body,type="text/plain; charset=utf-8",extra={}){
  const payload=Buffer.from(body);
  res.writeHead(status,{...baseHeaders(type,payload.length),...extra});
  res.end(payload);
}
function json(res,status,obj,extra={}){send(res,status,JSON.stringify(obj),"application/json; charset=utf-8",extra)}
async function readJson(req,limit=24_000){
  let size=0;const chunks=[];
  for await (const chunk of req){size+=chunk.length;if(size>limit) throw new Error("payload_too_large");chunks.push(chunk)}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
function clean(v,max=160){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function cleanDetails(v){
  if(!v||typeof v!=="object"||Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).slice(0,20).map(([k,val])=>[clean(k,60),clean(val,240)]));
}
function clientKey(req){return String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim()}
function allowed(req){
  const key=clientKey(req),now=Date.now(),windowMs=60*60*1000,max=12;
  const prev=rate.get(key)||[];const next=prev.filter(t=>now-t<windowMs);
  if(next.length>=max){rate.set(key,next);return false}
  next.push(now);rate.set(key,next);return true;
}
function publicIntakeCors(req){
  const origin=String(req.headers.origin||"");
  if(!origin||!PUBLIC_INTAKE_ORIGINS.has(origin)) return {};
  return {
    "access-control-allow-origin":origin,
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"content-type",
    "vary":"origin"
  };
}
function validEmbed(url){
  if(!url) return "";
  try{const u=new URL(url);if(u.protocol!=="https:") return "";return u.toString()}catch{return ""}
}
function controlAuthorized(req){
  if(CONTROL_TOKEN.length<24) return false;
  const header=String(req.headers.authorization||"");
  if(!header.startsWith("Bearer ")) return false;
  const supplied=header.slice(7).trim();
  const a=Buffer.from(CONTROL_TOKEN);
  const b=Buffer.from(supplied);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
async function engineRequest(path,{method="GET",body=null,auth=false,timeout=1200}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const headers={};
    if(body!==null) headers["content-type"]="application/json";
    if(auth){
      if(ENGINE_TOKEN.length<24) throw new Error("engine_token_unavailable");
      headers.authorization="Bearer "+ENGINE_TOKEN;
    }
    const response=await fetch(ENGINE_URL+path,{
      method,headers,body:body===null?undefined:JSON.stringify(body),cache:"no-store",signal:controller.signal
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload?.error||("engine_http_"+response.status));
    return payload;
  }finally{clearTimeout(timer)}
}
async function readSubmissionRecords(limit=100){
  try{
    const engine=await engineRequest("/v1/submissions?limit="+Math.max(1,Math.min(limit,200)),{auth:true});
    if(Array.isArray(engine.records)) return engine.records;
  }catch{}
  try{
    const raw=await readFile(join(DATA_DIR,"submissions.ndjson"),"utf8");
    return raw.trim().split("\n").filter(Boolean).slice(-Math.max(1,Math.min(limit,200))).reverse().map(line=>{
      try{return JSON.parse(line)}catch{return null}
    }).filter(Boolean);
  }catch{return []}
}
async function readOperations(){
  try{return JSON.parse(await readFile(join(ROOT,"control-operations.json"),"utf8"))}catch{return null}
}
async function readEngineState(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),900);
  try{
    const response=await fetch(ENGINE_URL+"/v1/state",{cache:"no-store",signal:controller.signal});
    if(!response.ok) throw new Error("engine_status");
    const body=await response.json();
    if(body?.authority!=="IZAKHONO"||body?.engine!=="YHVH GOSPEL ENGINE") throw new Error("engine_identity");
    return {available:true,mode:body.mode,programme:body.programme,ingest:body.ingest,schedule:body.schedule,adapters:body.adapters};
  }catch{
    return {available:false,mode:"degraded",programme:null,ingest:{healthy:false,last_heartbeat:null,label:""},schedule:null,adapters:[]};
  }finally{clearTimeout(timer)}
}
async function readReconciliation(){
  try{
    const x=JSON.parse(await readFile(RECONCILE_RECEIPT,"utf8"));
    return {
      available:true,
      authority:x.authority==="IZAKHONO"?"IZAKHONO":"unknown",
      source_authoritative:x.source_authoritative===true,
      scanned:Number(x.scanned||0),
      imported:Number(x.imported||0),
      duplicates:Number(x.duplicates||0),
      failed:Number(x.failed||0),
      completed_at:clean(x.completed_at,80),
      worker:clean(x.worker,100)
    };
  }catch{
    return {available:false,authority:"IZAKHONO",source_authoritative:false,scanned:0,imported:0,duplicates:0,failed:0,completed_at:"",worker:""};
  }
}
async function readDeploymentReceipt(){
  try{
    const x=JSON.parse(await readFile(DEPLOYMENT_RECEIPT,"utf8"));
    return {
      available:true,
      schema:clean(x.schema,100),
      product:clean(x.product,120),
      product_id:clean(x.product_id||"yhvh-gospel-tv",80),
      legacy_runtime_id:clean(x.legacy_runtime_id||x.app||"kora-gospel-tv",80),
      engine_id:clean(x.engine_id||"yhvh-gospel-engine",80),
      engine_authoritative:x.engine_authoritative===true,
      hostname:clean(x.hostname,180),
      revision:clean(x.revision,100),
      source:clean(x.source,80),
      runtime:clean(x.runtime,80),
      edge:clean(x.edge,80),
      engine:clean(x.engine,80),
      public_https:clean(x.public_https,80),
      generated_at:clean(x.generated_at,80)
    };
  }catch{
    return {
      available:false,
      product:"YHVH GOSPEL TV",
      product_id:"yhvh-gospel-tv",
      legacy_runtime_id:"kora-gospel-tv",
      engine_id:"yhvh-gospel-engine",
      engine_authoritative:true
    };
  }
}
async function readOwnerAgentProof(){
  try{
    const x=JSON.parse(await readFile(OWNER_AGENT_PROOF,"utf8"));
    return {
      available:true,
      schema:clean(x.schema,100),
      product_id:clean(x.product_id,80),
      engine_id:clean(x.engine_id,80),
      request_id:clean(x.request_id,140),
      action:clean(x.action,80),
      status:clean(x.status,60),
      attempts:Number(x.attempts||0),
      exit_code:Number(x.exit_code||0),
      source_commit:clean(x.source_commit,100),
      source_authority:clean(x.source_authority,80),
      started_at:clean(x.started_at,80),
      ended_at:clean(x.ended_at,80),
      secrets_exposed:x.secrets_exposed===true,
      log_path_exposed:x.log_path_exposed===true
    };
  }catch{
    return {
      available:false,
      product_id:"yhvh-gospel-tv",
      engine_id:"yhvh-gospel-engine"
    };
  }
}
async function controlStatus(){
  const records=await readSubmissionRecords(200);
  const operations=await readOperations();
  const reconciliation=await readReconciliation();
  const engine=await readEngineState();
  const counts=records.reduce((acc,row)=>{acc[row.category]=(acc[row.category]||0)+1;return acc},{});
  const applicants=records.filter(row=>["yhvh-global-acquisition-desk","kora-global-acquisition-desk"].includes(String(row.source_channel||row.sourceChannel||"")));
  const classes=applicants.reduce((acc,row)=>{
    const key=String(row.details?.partnerClass||"unspecified");
    acc[key]=(acc[key]||0)+1;
    return acc;
  },{});
  const reviewFlags={
    minors:applicants.filter(row=>String(row.details?.minorsInvolved||"")==="yes").length,
    fundraising:applicants.filter(row=>String(row.details?.fundraisingInvolved||"")==="yes").length,
    health_claims:applicants.filter(row=>String(row.details?.healthClaims||"")==="yes").length
  };
  return {
    ok:true,
    service:"kora-gospel-tv-control",
    runtime:"izakhono-owned",
    channel:{mode:engine.available?engine.mode:(validEmbed(LIVE_EMBED_URL)?"live-feed":"launch-mode"),live_feed_configured:Boolean(validEmbed(LIVE_EMBED_URL))},
    engine,
    queues:{content:counts.content||0,partner:counts.partner||0,prayer:counts.prayer||0,total:records.length},
    onboarding:{
      charter_version:"2026-09-25",
      total:applicants.length,
      verification_pending:applicants.filter(row=>String(row.details?.verificationStatus||"pending")==="pending").length,
      partner_classes:classes,
      review_flags:reviewFlags
    },
    regions:[
      {id:"africa",name:"Africa",status:"launch-region"},
      {id:"europe",name:"Europe",status:"distribution-ready"},
      {id:"north-america",name:"North America",status:"distribution-ready"},
      {id:"latin-america",name:"Latin America & Caribbean",status:"distribution-ready"},
      {id:"asia-pacific",name:"Asia-Pacific",status:"distribution-ready"},
      {id:"middle-east",name:"Middle East",status:"review-required"}
    ],
    priority_languages:["English","French","Portuguese","Spanish","Swahili","isiZulu","isiXhosa"],
    operations,
    reconciliation,
    controls:{write_actions:false,note:"Read-only owner control foundation. Broadcast write actions require a separate audited control path."}
  };
}
async function saveSubmission(data,req){
  const payload={
    category:clean(data.category,30),type:clean(data.type,50),name:clean(data.name,120),
    contact:clean(data.contact,160),message:clean(data.message,1600),onAir:Boolean(data.onAir),
    territory:clean(data.territory,80),language:clean(data.language,50),
    rightsAttested:Boolean(data.rightsAttested),sourceChannel:clean(data.sourceChannel||"yhvh-owned",60),
    details:cleanDetails(data.details)
  };
  try{
    const engine=await engineRequest("/v1/submissions",{method:"POST",body:payload,timeout:1800});
    if(engine?.ok&&engine?.reference) return {reference:engine.reference,engine:true};
  }catch{}
  await mkdir(DATA_DIR,{recursive:true});
  const reference="YHVH-BUFFER-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();
  const record={
    schema:"yhvh.gospel-tv.submission-buffer/v1",reference,created_at:new Date().toISOString(),
    ...payload,
    on_air:payload.onAir,
    rights_attested:payload.rightsAttested,
    source_channel:payload.sourceChannel,
    authoritative:false
  };
  delete record.onAir;
  delete record.rightsAttested;
  delete record.sourceChannel;
  await appendFile(join(DATA_DIR,"submissions.ndjson"),JSON.stringify(record)+"\n",{encoding:"utf8",mode:0o600});
  return {reference,engine:false};
}

createServer(async (req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  if(url.pathname==="/health"||url.pathname==="/api/health"){
    const engine=await readEngineState();
    return json(res,200,{
      ok:true,
      service:"kora-gospel-tv",
      product:"YHVH GOSPEL TV",
      product_id:"yhvh-gospel-tv",
      legacy_runtime_id:"kora-gospel-tv",
      engine_id:"yhvh-gospel-engine",
      engine_authoritative:engine.available===true,
      runtime:"izakhono-owned",
      version:"hybrid-2",
      engine
    },{"access-control-allow-origin":"*"});
  }

  if(url.pathname==="/api/channel" && req.method==="GET"){
    const engine=await readEngineState();
    return json(res,200,{
      name:"YHVH GOSPEL TV",
      promise:"Faith. Worship. Word. Africa to the World.",
      mode:engine.available?engine.mode:(validEmbed(LIVE_EMBED_URL)?"live-feed":"launch-mode"),
      liveEmbedUrl:validEmbed(LIVE_EMBED_URL),
      engine,
      distribution:{
        policy:"owned-primary-external-distribution",
        primary:{provider:"IZAKHONO",role:"origin-control-plane",url:"https://gospel.domains.izakhonoafrica.co.za",authoritative:true},
        external:[
          {provider:"Vercel",role:"distribution-discovery",url:"https://kora-network.vercel.app/gospel",authoritative:false},
          {provider:"GitHub Pages",role:"public-fallback",url:"https://bevanshelton-netizen.github.io/Downloads/kora-gospel-tv/",authoritative:false}
        ]
      }
    },{"access-control-allow-origin":"*"});
  }

  if(url.pathname==="/api/deployment/status" && req.method==="GET"){
    return json(res,200,{
      authority:"IZAKHONO",
      product:"YHVH GOSPEL TV",
      product_id:"yhvh-gospel-tv",
      receipt:await readDeploymentReceipt(),
      owner_agent:await readOwnerAgentProof()
    },{"access-control-allow-origin":"*"});
  }

  if(url.pathname==="/api/control/status" && req.method==="GET"){
    if(CONTROL_TOKEN.length<24) return json(res,503,{error:"Owner control room is not enabled on this runtime."});
    if(!controlAuthorized(req)) return json(res,401,{error:"Owner authorization required."},{"www-authenticate":"Bearer"});
    return json(res,200,await controlStatus());
  }

  if(url.pathname==="/api/control/submissions" && req.method==="GET"){
    if(CONTROL_TOKEN.length<24) return json(res,503,{error:"Owner control room is not enabled on this runtime."});
    if(!controlAuthorized(req)) return json(res,401,{error:"Owner authorization required."},{"www-authenticate":"Bearer"});
    const limit=Math.max(1,Math.min(Number(url.searchParams.get("limit")||50),100));
    return json(res,200,{ok:true,records:await readSubmissionRecords(limit)});
  }

  if(url.pathname==="/api/submissions" && req.method==="OPTIONS"){
    const cors=publicIntakeCors(req);
    if(!cors["access-control-allow-origin"]) return json(res,403,{error:"Origin not allowed."});
    res.writeHead(204,cors);return res.end();
  }

  if(url.pathname==="/api/submissions" && req.method==="POST"){
    const cors=publicIntakeCors(req);
    const origin=String(req.headers.origin||"");
    if(origin && !cors["access-control-allow-origin"]) return json(res,403,{error:"Origin not allowed."});
    if(!allowed(req)) return json(res,429,{error:"Too many submissions. Please try again later."},{...cors,"retry-after":"3600"});
    try{
      const data=await readJson(req);
      const category=clean(data.category,30);
      if(!["content","partner","prayer"].includes(category)) return json(res,400,{error:"Invalid submission category."},cors);
      if(category!=="prayer" && (!clean(data.name,120)||!clean(data.contact,160))) return json(res,400,{error:"Name and contact details are required."},cors);
      if(!clean(data.message,1600)) return json(res,400,{error:"Please add a message."},cors);
      const sourceChannel=clean(data.sourceChannel||"yhvh-owned",60);
      const details=cleanDetails(data.details);
      if(["yhvh-global-acquisition-desk","kora-global-acquisition-desk"].includes(sourceChannel)){
        if(details.charterVersion!=="2026-09-25"||details.charterAccepted!=="true") return json(res,400,{error:"The current YHVH Partner & Contributor Charter must be accepted."},cors);
        if(details.editorialIndependence!=="true") return json(res,400,{error:"Editorial independence must be acknowledged."},cors);
        if(data.rightsAttested!==true) return json(res,400,{error:"Rights and permissions attestation is required."},cors);
        if(details.minorsInvolved==="yes"&&details.safeguardingAttested!=="true") return json(res,400,{error:"Safeguarding attestation is required when minors are involved."},cors);
      }
      const saved=await saveSubmission(data,req);
      return json(res,201,{
        ok:true,
        reference:saved.reference,
        route:"izakhono-owned",
        engine_route:saved.engine?"yhvh-owned-engine":"local-resilience-buffer",
        authoritative:saved.engine===true
      },cors);
    }catch(err){
      if(String(err?.message)==="payload_too_large") return json(res,413,{error:"Submission is too large."},cors);
      return json(res,400,{error:"Unable to process this submission."},cors);
    }
  }

  if(!["GET","HEAD"].includes(req.method||"GET")) return send(res,405,"Method not allowed");

  let pathname=decodeURIComponent(url.pathname);
  if(pathname==="/") pathname="/index.html";
  const safe=normalize(pathname).replace(/^([.][.][/\\])+/, "");
  const file=resolve(join(ROOT,safe));
  if(!file.startsWith(ROOT)) return send(res,403,"Forbidden");

  try{
    const s=await stat(file);if(!s.isFile()) throw new Error("not-file");
    const data=await readFile(file);const ext=extname(file).toLowerCase();
    res.writeHead(200,baseHeaders(types[ext]||"application/octet-stream",data.length,ext===".html"?"no-store":"public, max-age=3600"));
    if(req.method==="HEAD") return res.end();res.end(data);
  }catch{send(res,404,"Not found")}
}).listen(PORT,HOST,()=>console.log(`YHVH GOSPEL TV listening on http://${HOST}:${PORT}`));

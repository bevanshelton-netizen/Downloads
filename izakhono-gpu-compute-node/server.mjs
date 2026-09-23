import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8865);
const DB_PATH=resolve(process.env.IZAKHONO_GPU_COMPUTE_DB||"./data/gpu-compute.sqlite");
const SERVICE_KEY=process.env.IZAKHONO_GPU_COMPUTE_KEY||"";
const WORKER_KEY=process.env.IZAKHONO_GPU_WORKER_KEY||"";
const ALLOW=(process.env.IZAKHONO_GPU_WORKER_ALLOWLIST||"127.0.0.1,localhost,::1").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
const STALE=Math.max(10,Number(process.env.IZAKHONO_GPU_STALE_SECONDS||45))*1000;
const TIMEOUT=Math.max(1000,Number(process.env.IZAKHONO_GPU_TIMEOUT_MS||120000));

mkdirSync(dirname(DB_PATH),{recursive:true});
const db=new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS workers(
 id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,endpoint TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,
 models_json TEXT NOT NULL,gpus_json TEXT NOT NULL,total_vram_mb INTEGER NOT NULL DEFAULT 0,
 free_vram_mb INTEGER NOT NULL DEFAULT 0,utilization_pct REAL NOT NULL DEFAULT 0,
 active_requests INTEGER NOT NULL DEFAULT 0,queue_depth INTEGER NOT NULL DEFAULT 0,
 last_seen TEXT NOT NULL DEFAULT (datetime('now')),failures INTEGER NOT NULL DEFAULT 0,
 circuit_until TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS gpu_workers_health_idx ON workers(enabled,last_seen,circuit_until);
CREATE TABLE IF NOT EXISTS request_ledger(
 id TEXT PRIMARY KEY,occurred_at TEXT NOT NULL DEFAULT (datetime('now')),model_alias TEXT NOT NULL,
 worker_name TEXT,status TEXT NOT NULL,http_status INTEGER,latency_ms INTEGER,
 input_estimate INTEGER NOT NULL DEFAULT 0,output_estimate INTEGER NOT NULL DEFAULT 0,
 prompt_hash TEXT,error TEXT
);
`);

const out=(res,status,body)=>{const p=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json","content-length":Buffer.byteLength(p),"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(p)};
const eq=(a,b)=>{const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&timingSafeEqual(x,y)};
const bearer=req=>{const a=String(req.headers.authorization||"");return a.startsWith("Bearer ")?a.slice(7).trim():String(req.headers["x-api-key"]||"")};
const serviceAuthed=req=>Boolean(SERVICE_KEY)&&eq(bearer(req),SERVICE_KEY);
const workerAuthed=req=>Boolean(WORKER_KEY)&&eq(req.headers["x-izakhono-worker-key"],WORKER_KEY);

async function body(req){
 let n=0,ch=[]; for await(const c of req){n+=c.length;if(n>4*1024*1024)throw new Error("BODY_TOO_LARGE");ch.push(c)}
 return ch.length?JSON.parse(Buffer.concat(ch).toString("utf8")):{};
}
function endpoint(v){
 const u=new URL(String(v||"")); if(!["http:","https:"].includes(u.protocol)||u.username||u.password)throw new Error("INVALID_ENDPOINT");
 if(!ALLOW.includes(u.hostname.toLowerCase()))throw new Error("WORKER_HOST_NOT_ALLOWED");
 return u.origin+u.pathname.replace(/\/$/,"");
}
function normalizeModels(v){
 if(!Array.isArray(v)||!v.length)throw new Error("INVALID_MODELS");
 return v.map(x=>typeof x==="string"?{alias:x.toLowerCase(),upstreamModel:x}:{alias:String(x.alias||"").toLowerCase(),upstreamModel:String(x.upstreamModel||x.model||"")}).filter(x=>x.alias&&x.upstreamModel);
}
function normalizeGpus(v){
 if(!Array.isArray(v))throw new Error("INVALID_GPUS");
 return v.map((g,i)=>({index:g.index??i,vendor:String(g.vendor||"unknown"),model:String(g.model||"unknown"),vramMb:Math.max(0,Number(g.vramMb||0)),freeVramMb:Math.max(0,Number(g.freeVramMb??g.vramMb??0)),utilizationPct:Math.max(0,Math.min(100,Number(g.utilizationPct||0)))}));
}
function caps(g){return{total:g.reduce((n,x)=>n+x.vramMb,0),free:g.reduce((n,x)=>n+x.freeVramMb,0),util:g.length?g.reduce((n,x)=>n+x.utilizationPct,0)/g.length:0}}
function parseModels(r){try{return JSON.parse(r.models_json||"[]")}catch{return[]}}
function fresh(r){const t=Date.parse(String(r.last_seen).replace(" ","T")+"Z");return Number.isFinite(t)&&Date.now()-t<=STALE}
function circuit(r){if(!r.circuit_until)return false;const t=Date.parse(String(r.circuit_until).replace(" ","T")+"Z");return Number.isFinite(t)&&t>Date.now()}
function model(r,a){return parseModels(r).find(x=>x.alias===a)}
function publicWorker(r){return{id:r.id,name:r.name,models:parseModels(r),gpus:JSON.parse(r.gpus_json||"[]"),totalVramMb:r.total_vram_mb,freeVramMb:r.free_vram_mb,utilizationPct:r.utilization_pct,activeRequests:r.active_requests,queueDepth:r.queue_depth,lastSeen:r.last_seen,healthy:Boolean(r.enabled)&&fresh(r)&&!circuit(r)}}

function upsertWorker(b){
 const name=String(b.name||"").trim().toLowerCase(); if(!/^[a-z0-9][a-z0-9._:-]{1,100}$/i.test(name))throw new Error("INVALID_WORKER_NAME");
 const ep=endpoint(b.endpoint),ms=normalizeModels(b.models),gs=normalizeGpus(b.gpus||[]),c=caps(gs);
 const row=db.prepare("SELECT id FROM workers WHERE name=?").get(name),id=row?.id||randomUUID();
 if(row)db.prepare("UPDATE workers SET endpoint=?,enabled=1,models_json=?,gpus_json=?,total_vram_mb=?,free_vram_mb=?,utilization_pct=?,queue_depth=?,last_seen=datetime('now'),circuit_until=NULL,updated_at=datetime('now') WHERE id=?").run(ep,JSON.stringify(ms),JSON.stringify(gs),c.total,c.free,c.util,Number(b.queueDepth||0),id);
 else db.prepare("INSERT INTO workers(id,name,endpoint,models_json,gpus_json,total_vram_mb,free_vram_mb,utilization_pct,queue_depth) VALUES(?,?,?,?,?,?,?,?,?)").run(id,name,ep,JSON.stringify(ms),JSON.stringify(gs),c.total,c.free,c.util,Number(b.queueDepth||0));
 return db.prepare("SELECT * FROM workers WHERE id=?").get(id);
}
function heartbeat(id,b){
 const r=db.prepare("SELECT * FROM workers WHERE id=?").get(id); if(!r)throw new Error("WORKER_NOT_FOUND");
 const gs=b.gpus?normalizeGpus(b.gpus):JSON.parse(r.gpus_json||"[]"),ms=b.models?normalizeModels(b.models):parseModels(r),c=caps(gs);
 db.prepare("UPDATE workers SET models_json=?,gpus_json=?,total_vram_mb=?,free_vram_mb=?,utilization_pct=?,queue_depth=?,last_seen=datetime('now'),updated_at=datetime('now') WHERE id=?").run(JSON.stringify(ms),JSON.stringify(gs),c.total,c.free,c.util,Number(b.queueDepth||0),id);
 return db.prepare("SELECT * FROM workers WHERE id=?").get(id);
}
function candidates(alias){
 return db.prepare("SELECT * FROM workers WHERE enabled=1").all().filter(r=>fresh(r)&&!circuit(r)&&model(r,alias)).sort((a,b)=>Number(b.free_vram_mb)-Number(a.free_vram_mb)||Number(a.active_requests)-Number(b.active_requests)||Number(a.queue_depth)-Number(b.queue_depth));
}
function fail(id){
 const r=db.prepare("SELECT failures FROM workers WHERE id=?").get(id),n=Number(r?.failures||0)+1;
 if(n>=3)db.prepare("UPDATE workers SET failures=0,circuit_until=datetime('now','+60 seconds') WHERE id=?").run(id);
 else db.prepare("UPDATE workers SET failures=? WHERE id=?").run(n,id);
}
function ok(id){db.prepare("UPDATE workers SET failures=0,circuit_until=NULL WHERE id=?").run(id)}
function reserve(id,d){db.prepare("UPDATE workers SET active_requests=max(0,active_requests+?) WHERE id=?").run(d,id)}
function promptMeta(messages){
 if(!Array.isArray(messages)||!messages.length)throw new Error("INVALID_MESSAGES");
 const s=messages.map(m=>String(m.role||"")+":"+String(m.content||"")).join("\n");
 return{tokens:Math.max(1,Math.ceil(s.length/4)),hash:createHash("sha256").update(s).digest("hex")};
}
function log(e){db.prepare("INSERT INTO request_ledger(id,model_alias,worker_name,status,http_status,latency_ms,input_estimate,output_estimate,prompt_hash,error) VALUES(?,?,?,?,?,?,?,?,?,?)").run(e.id,e.alias,e.worker||null,e.status,e.http||null,e.ms||null,e.input||0,e.output||0,e.hash||null,e.error||null)}

async function chat(b){
 const alias=String(b.model||"").toLowerCase();if(!alias)throw new Error("MODEL_REQUIRED");
 const pm=promptMeta(b.messages),list=candidates(alias);if(!list.length){const e=new Error("NO_GPU_CAPACITY");e.status=503;throw e}
 let last;
 for(const w of list){
  const route=model(w,alias),id=randomUUID(),started=Date.now();reserve(w.id,1);
  try{
   const r=await fetch(w.endpoint+"/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",...(WORKER_KEY?{"authorization":"Bearer "+WORKER_KEY}:{})},body:JSON.stringify({...b,model:route.upstreamModel,stream:false}),signal:AbortSignal.timeout(TIMEOUT)});
   const raw=await r.text();let p;try{p=JSON.parse(raw)}catch{p={error:{message:"INVALID_WORKER_JSON"}}}
   if(!r.ok)throw Object.assign(new Error(p?.error?.message||"WORKER_ERROR"),{http:r.status});
   ok(w.id);const ms=Date.now()-started;const outTokens=Number(p?.usage?.completion_tokens||0)||Math.ceil(String(p?.choices?.[0]?.message?.content||"").length/4);
   log({id,alias,worker:w.name,status:"ok",http:r.status,ms,input:pm.tokens,output:outTokens,hash:pm.hash});
   p.model=alias;p.izakhono_gpu={worker:w.name,owned_compute:true};return p;
  }catch(e){fail(w.id);last=e;log({id,alias,worker:w.name,status:"error",http:e.http||502,ms:Date.now()-started,input:pm.tokens,hash:pm.hash,error:String(e.message).slice(0,1200)})}
  finally{reserve(w.id,-1)}
 }
 const e=new Error(last?.message||"GPU_WORKERS_FAILED");e.status=502;throw e;
}

createServer(async(req,res)=>{
 try{
  const u=new URL(req.url||"/","http://localhost");
  if(req.method==="GET"&&u.pathname==="/health"){const all=db.prepare("SELECT * FROM workers").all(),good=all.filter(r=>fresh(r)&&!circuit(r)&&r.enabled);return out(res,200,{service:"IZAKHONO GPU COMPUTE NODE",status:"healthy",workers:all.length,healthyWorkers:good.length,totalVramMb:good.reduce((n,r)=>n+Number(r.total_vram_mb),0),freeVramMb:good.reduce((n,r)=>n+Number(r.free_vram_mb),0)})}
  if(req.method==="POST"&&u.pathname==="/v1/workers/register"){if(!workerAuthed(req))return out(res,401,{error:"Unauthorized worker"});return out(res,200,{worker:publicWorker(upsertWorker(await body(req)))})}
  const hb=u.pathname.match(/^\/v1\/workers\/([^/]+)\/heartbeat$/);
  if(req.method==="POST"&&hb){if(!workerAuthed(req))return out(res,401,{error:"Unauthorized worker"});return out(res,200,{worker:publicWorker(heartbeat(hb[1],await body(req)))})}
  if(!serviceAuthed(req))return out(res,401,{error:"Unauthorized"});
  if(req.method==="GET"&&u.pathname==="/v1/workers")return out(res,200,{workers:db.prepare("SELECT * FROM workers ORDER BY name").all().map(publicWorker)});
  if(req.method==="GET"&&u.pathname==="/v1/models"){const ids=[...new Set(db.prepare("SELECT * FROM workers WHERE enabled=1").all().flatMap(r=>parseModels(r).map(m=>m.alias)))].sort();return out(res,200,{object:"list",data:ids.map(id=>({id,object:"model",owned_by:"izakhono"}))})}
  if(req.method==="GET"&&u.pathname==="/v1/capacity"){const ws=db.prepare("SELECT * FROM workers").all().map(publicWorker),good=ws.filter(w=>w.healthy);return out(res,200,{workers:ws,totals:{workers:ws.length,healthyWorkers:good.length,totalVramMb:good.reduce((n,w)=>n+w.totalVramMb,0),freeVramMb:good.reduce((n,w)=>n+w.freeVramMb,0),activeRequests:ws.reduce((n,w)=>n+w.activeRequests,0),queueDepth:ws.reduce((n,w)=>n+w.queueDepth,0)}})}
  if(req.method==="POST"&&u.pathname==="/v1/chat/completions"){return out(res,200,await chat(await body(req)))}
  return out(res,404,{error:"Not found"});
 }catch(e){const m=String(e?.message||e),status=Number(e?.status)||(["INVALID_ENDPOINT","WORKER_HOST_NOT_ALLOWED","INVALID_MODELS","INVALID_GPUS","INVALID_WORKER_NAME","INVALID_MESSAGES","MODEL_REQUIRED"].includes(m)?400:m==="BODY_TOO_LARGE"?413:500);return out(res,status,{error:m})}
}).listen(PORT,HOST,()=>console.log(`IZAKHONO GPU COMPUTE NODE listening on http://${HOST}:${PORT}`));

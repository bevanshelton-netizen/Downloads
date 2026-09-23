import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { timingSafeEqual } from "node:crypto";

const execFileAsync=promisify(execFile);
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8866);
const NAME=(process.env.IZAKHONO_MODEL_WORKER_NAME||"model-worker-01").toLowerCase();
const WORKER_KEY=process.env.IZAKHONO_GPU_WORKER_KEY||"";
const COMPUTE_URL=(process.env.IZAKHONO_GPU_COMPUTE_URL||"http://127.0.0.1:8865").replace(/\/$/,"");
const ENGINE_URL=new URL(process.env.IZAKHONO_MODEL_ENGINE_URL||"http://127.0.0.1:11434");
const ENGINE_CHAT_PATH=process.env.IZAKHONO_MODEL_ENGINE_CHAT_PATH||"/v1/chat/completions";
const ENGINE_KEY=process.env.IZAKHONO_MODEL_ENGINE_KEY||"";
const ALLOW_CPU=String(process.env.IZAKHONO_MODEL_WORKER_ALLOW_CPU||"true").toLowerCase()!=="false";
const HEARTBEAT_MS=Math.max(5000,Number(process.env.IZAKHONO_MODEL_WORKER_HEARTBEAT_MS||15000));
const TIMEOUT_MS=Math.max(5000,Number(process.env.IZAKHONO_MODEL_ENGINE_TIMEOUT_MS||120000));
const ENGINE_ALLOWLIST=(process.env.IZAKHONO_MODEL_ENGINE_ALLOWLIST||"127.0.0.1,localhost,::1").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);

function parseModels(){
  let x;try{x=JSON.parse(process.env.IZAKHONO_MODEL_WORKER_MODELS||"[]")}catch{return[]}
  if(!Array.isArray(x))return[];
  return x.map(v=>typeof v==="string"?{alias:v.toLowerCase(),upstreamModel:v}:{alias:String(v.alias||"").toLowerCase(),upstreamModel:String(v.upstreamModel||v.model||"")}).filter(v=>/^[a-z0-9][a-z0-9._:-]{1,100}$/.test(v.alias)&&v.upstreamModel);
}
const MODELS=parseModels();
if(!["http:","https:"].includes(ENGINE_URL.protocol)||!ENGINE_ALLOWLIST.includes(ENGINE_URL.hostname.toLowerCase()))throw new Error("MODEL_ENGINE_HOST_NOT_ALLOWED");
if(!ENGINE_CHAT_PATH.startsWith("/")||ENGINE_CHAT_PATH.includes(".."))throw new Error("INVALID_ENGINE_CHAT_PATH");

function eq(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&timingSafeEqual(x,y);}
function bearer(req){const a=String(req.headers.authorization||"");return a.startsWith("Bearer ")?a.slice(7).trim():"";}
function json(res,status,body){const p=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(p),"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(p);}
async function body(req){let n=0,ch=[];for await(const c of req){n+=c.length;if(n>4*1024*1024)throw new Error("BODY_TOO_LARGE");ch.push(c)}return ch.length?JSON.parse(Buffer.concat(ch).toString("utf8")):{};}

async function gpuStats(){
  try{
    const {stdout}=await execFileAsync("nvidia-smi",["--query-gpu=index,name,memory.total,memory.free,utilization.gpu","--format=csv,noheader,nounits"],{timeout:3000});
    return stdout.trim().split(/\r?\n/).filter(Boolean).map(line=>{
      const parts=line.split(",").map(x=>x.trim());
      return {index:Number(parts[0]),vendor:"NVIDIA",model:parts[1],vramMb:Number(parts[2]),freeVramMb:Number(parts[3]),utilizationPct:Number(parts[4])};
    });
  }catch{return[]}
}
async function engineHealth(){
  if(!MODELS.length)return false;
  try{
    const url=new URL("/v1/models",ENGINE_URL).toString();
    const r=await fetch(url,{headers:ENGINE_KEY?{"authorization":"Bearer "+ENGINE_KEY}:{},signal:AbortSignal.timeout(2500)});
    return r.ok;
  }catch{
    try{
      const r=await fetch(ENGINE_URL,{signal:AbortSignal.timeout(1500)});return r.ok;
    }catch{return false}
  }
}
async function register(){
  if(!WORKER_KEY||!MODELS.length)return {registered:false};
  const gpus=await gpuStats();
  if(!gpus.length&&!ALLOW_CPU)return {registered:false};
  const payload={name:NAME,endpoint:`http://127.0.0.1:${PORT}`,models:MODELS,gpus,queueDepth:0};
  const r=await fetch(COMPUTE_URL+"/v1/workers/register",{method:"POST",headers:{"content-type":"application/json","x-izakhono-worker-key":WORKER_KEY},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"WORKER_REGISTER_FAILED");
  return {registered:true,id:j.worker?.id,gpus};
}
let workerId=null,registrationError=null;
async function heartbeat(){
  try{
    if(!workerId){const r=await register();workerId=r.id||null;if(!r.registered)return;}
    const gpus=await gpuStats();
    const r=await fetch(COMPUTE_URL+"/v1/workers/"+encodeURIComponent(workerId)+"/heartbeat",{method:"POST",headers:{"content-type":"application/json","x-izakhono-worker-key":WORKER_KEY},body:JSON.stringify({models:MODELS,gpus,queueDepth:0}),signal:AbortSignal.timeout(5000)});
    if(!r.ok){workerId=null;throw new Error("WORKER_HEARTBEAT_FAILED")}
    registrationError=null;
  }catch(e){registrationError=String(e?.message||e);workerId=null;}
}
setInterval(heartbeat,HEARTBEAT_MS).unref();

createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||"/","http://localhost");
    if(req.method==="GET"&&u.pathname==="/health"){
      const gpus=await gpuStats(),engine=await engineHealth();
      return json(res,200,{service:"IZAKHONO MODEL WORKER",status:"healthy",ready:Boolean(MODELS.length&&engine&&(gpus.length||ALLOW_CPU)),registered:Boolean(workerId),engineReachable:engine,models:MODELS.map(x=>x.alias),gpuCount:gpus.length,cpuFallbackAllowed:ALLOW_CPU,registrationError});
    }
    if(!WORKER_KEY||!eq(bearer(req),WORKER_KEY))return json(res,401,{error:"Unauthorized worker"});
    if(req.method==="POST"&&u.pathname==="/v1/chat/completions"){
      const input=await body(req),allowed=new Set(MODELS.map(x=>x.upstreamModel));
      if(!allowed.has(String(input.model||"")))return json(res,400,{error:"Model not configured on worker"});
      const url=new URL(ENGINE_CHAT_PATH,ENGINE_URL).toString();
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...(ENGINE_KEY?{"authorization":"Bearer "+ENGINE_KEY}:{})},body:JSON.stringify({...input,stream:false}),signal:AbortSignal.timeout(TIMEOUT_MS)});
      const raw=await r.text();res.writeHead(r.status,{"content-type":r.headers.get("content-type")||"application/json","cache-control":"no-store","x-content-type-options":"nosniff"});return res.end(raw);
    }
    return json(res,404,{error:"Not found"});
  }catch(e){
    const m=String(e?.message||e),status=m==="BODY_TOO_LARGE"?413:502;console.error("model worker",m);return json(res,status,{error:m});
  }
}).listen(PORT,HOST,async()=>{
  console.log(`IZAKHONO MODEL WORKER listening on http://${HOST}:${PORT}`);
  await heartbeat();
});

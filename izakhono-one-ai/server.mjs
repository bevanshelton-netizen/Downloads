import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8860);
const SERVICE_KEY=process.env.IZAKHONO_ONE_AI_KEY || "";
const GATEWAY_URL=new URL(process.env.IZAKHONO_ONE_AI_GATEWAY_URL || "http://127.0.0.1:8850");
const GATEWAY_KEY=process.env.IZAKHONO_ONE_AI_GATEWAY_KEY || "";
const MODEL_ALIAS=process.env.IZAKHONO_ONE_AI_MODEL_ALIAS || "izakhono-one";
const MAX_BODY=Math.min(10*1024*1024,Math.max(65536,Number(process.env.IZAKHONO_ONE_AI_MAX_BODY_BYTES || 2*1024*1024)));
const TIMEOUT_MS=Math.min(300000,Math.max(1000,Number(process.env.IZAKHONO_ONE_AI_TIMEOUT_MS || 90000)));
const CAPABILITIES=JSON.parse(readFileSync(resolve(new URL("./capabilities.json",import.meta.url).pathname),"utf8"));

function json(res,status,body,headers={}){
  const payload=JSON.stringify(body);
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":Buffer.byteLength(payload),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    ...headers
  });
  res.end(payload);
}
function secureEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}
function authed(req){
  const auth=String(req.headers.authorization||"");
  const raw=auth.startsWith("Bearer ")?auth.slice(7).trim():String(req.headers["x-api-key"]||"");
  return Boolean(SERVICE_KEY)&&secureEqual(raw,SERVICE_KEY);
}
async function readJson(req){
  let total=0;const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_BODY) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):{};
}
function baseInstructions(){
  const list=CAPABILITIES.replacements.map(x=>`${x.name} [${x.status}] — replaces ${x.replaces.join(", ")}`).join("\n");
  return [
    "You are IZAKHONO ONE AI, the intelligence layer for the IZAKHONO ONE ecosystem.",
    "Your job is to help the user work across IZAKHONO-owned services through one coherent assistant.",
    "Never claim an app or action is live if the capability registry marks it planned.",
    "Never claim to have taken an external action unless an action adapter actually reports success.",
    "Respect the standing privacy rule: no tracking, no behavioural profiling, no advertising IDs, no silent data collection.",
    "Owned compute and owned services are primary. External providers are reversible overflow/fallback only.",
    "Do not persist prompt or response bodies in the control plane.",
    "When a requested Google-equivalent capability is still planned, explain the owned IZAKHONO target and what is available now.",
    "Current capability registry:",
    list
  ].join("\n");
}
function normalizeMessages(messages){
  if(!Array.isArray(messages)||!messages.length||messages.length>300) throw new Error("INVALID_MESSAGES");
  return messages.map(m=>{
    if(!m||typeof m!=="object"||!["system","developer","user","assistant","tool"].includes(m.role)||typeof m.content!=="string"){
      throw new Error("INVALID_MESSAGES");
    }
    return {role:m.role,content:m.content};
  });
}
function gatewayEndpoint(){
  return new URL("/v1/chat/completions",GATEWAY_URL).toString();
}
async function chat(body){
  if(!GATEWAY_KEY) throw new Error("GATEWAY_KEY_MISSING");
  const messages=normalizeMessages(body.messages);
  const upstream={
    ...body,
    model:MODEL_ALIAS,
    stream:false,
    messages:[{role:"system",content:baseInstructions()},...messages]
  };
  const response=await fetch(gatewayEndpoint(),{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "accept":"application/json",
      "authorization":"Bearer "+GATEWAY_KEY
    },
    body:JSON.stringify(upstream),
    signal:AbortSignal.timeout(TIMEOUT_MS)
  });
  const text=await response.text();
  let payload;
  try{payload=JSON.parse(text);}catch{payload={error:{message:"AI gateway returned invalid JSON"}};}
  if(!response.ok){
    const error=new Error(payload?.error?.message||("AI_GATEWAY_HTTP_"+response.status));
    error.status=response.status;
    throw error;
  }
  if(payload&&typeof payload==="object"){
    payload.model=MODEL_ALIAS;
    payload.izakhono_one={
      owned_first:true,
      privacy:CAPABILITIES.privacy,
      capability_count:CAPABILITIES.replacements.length
    };
  }
  return payload;
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");
    if(req.method==="GET"&&url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO ONE AI",
        status:"healthy",
        modelAlias:MODEL_ALIAS,
        gateway:GATEWAY_URL.origin,
        capabilityCount:CAPABILITIES.replacements.length,
        tracking:false,
        promptPersistence:false
      });
    }
    if(req.method==="GET"&&url.pathname==="/v1/capabilities"){
      return json(res,200,CAPABILITIES);
    }
    if(!authed(req)) return json(res,401,{error:"Unauthorized"});
    if(req.method==="POST"&&url.pathname==="/v1/chat/completions"){
      const body=await readJson(req);
      const payload=await chat(body);
      return json(res,200,payload);
    }
    if(req.method==="POST"&&url.pathname==="/v1/plan"){
      const body=await readJson(req);
      const prompt=typeof body?.request==="string"?body.request.trim():"";
      if(!prompt) return json(res,400,{error:"request is required"});
      const payload=await chat({
        messages:[
          {role:"user",content:`Plan how IZAKHONO ONE should fulfil this request using only capabilities that are currently available or clearly label future capability dependencies. Do not pretend to execute actions. Request: ${prompt}`}
        ],
        temperature:0.2
      });
      return json(res,200,payload);
    }
    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Internal error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Payload too large"});
    if(message==="INVALID_MESSAGES") return json(res,400,{error:"Invalid messages"});
    if(message==="GATEWAY_KEY_MISSING") return json(res,503,{error:"IZAKHONO ONE AI gateway key is not configured"});
    const status=Number(error?.status)||500;
    console.error(message);
    return json(res,status>=400&&status<600?status:500,{error:message});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO ONE AI listening on http://${HOST}:${PORT}`);
  if(!SERVICE_KEY) console.warn("WARNING: IZAKHONO_ONE_AI_KEY missing; protected endpoints will reject requests.");
  if(!GATEWAY_KEY) console.warn("WARNING: IZAKHONO_ONE_AI_GATEWAY_KEY missing; inference will be unavailable.");
});

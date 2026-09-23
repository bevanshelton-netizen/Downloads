import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8860);
const SERVICE_KEY=process.env.IZAKHONO_ONE_AI_KEY || "";
const GATEWAY_URL=new URL(process.env.IZAKHONO_ONE_AI_GATEWAY_URL || "http://127.0.0.1:8850");
const GATEWAY_KEY=process.env.IZAKHONO_ONE_AI_GATEWAY_KEY || "";
const MODEL_ALIAS=process.env.IZAKHONO_ONE_AI_MODEL_ALIAS || "izakhono-one";
const MAX_BODY=Math.min(10*1024*1024,Math.max(65536,Number(process.env.IZAKHONO_ONE_AI_MAX_BODY_BYTES || 2*1024*1024)));
const TIMEOUT_MS=Math.min(300000,Math.max(1000,Number(process.env.IZAKHONO_ONE_AI_TIMEOUT_MS || 90000)));
const AUTH_URL=(process.env.IZAKHONO_ONE_AUTH_URL||"http://127.0.0.1:8820").replace(/\/$/,"");
const USAGE_DB=resolve(process.env.IZAKHONO_ONE_USAGE_DB||"./data/one-ai.sqlite");
const FREE_DAILY_REQUESTS=Math.max(0,Number(process.env.IZAKHONO_ONE_FREE_DAILY_REQUESTS||0));
const COOKIE_NAME="izakhono_one_session";
const CAPABILITIES=JSON.parse(readFileSync(resolve(new URL("./capabilities.json",import.meta.url).pathname),"utf8"));
const ROLLOUT=JSON.parse(readFileSync(resolve(new URL("./public-sellable-rollout.json",import.meta.url).pathname),"utf8"));
const PUBLIC_INDEX=readFileSync(resolve(new URL("./public/index.html",import.meta.url).pathname),"utf8");

mkdirSync(dirname(USAGE_DB),{recursive:true});
const usageDb=new DatabaseSync(USAGE_DB);
usageDb.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS usage_daily(
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(user_id,day)
  );
`);

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
function html(res,status,body){
  res.writeHead(status,{
    "content-type":"text/html; charset=utf-8",
    "content-length":Buffer.byteLength(body),
    "cache-control":"public, max-age=120",
    "x-content-type-options":"nosniff",
    "content-security-policy":"default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
  res.end(body);
}
function publicProducts(){
  return ROLLOUT.products.map(p=>({
    id:p.id,
    name:p.name,
    public_status:p.public_status,
    commercial_status:p.commercial_status,
    payment:p.payment,
    next_blocker:p.next_blocker,
    public_url:p.public_status==="owned-public-verified"
      ? p.owned_target
      : p.public_status==="temporary-public"
        ? p.fallback
        : null,
    owned_target:p.owned_target||null
  }));
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
function sameOrigin(req){
  const origin=String(req.headers.origin||"");
  if(!origin) return true;
  try{return new URL(origin).host===String(req.headers.host||"");}catch{return false;}
}
function cookieToken(req){
  const auth=String(req.headers.authorization||"");
  if(auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookies=String(req.headers.cookie||"").split(";").map(x=>x.trim());
  for(const cookie of cookies){
    if(cookie.startsWith(COOKIE_NAME+"=")) return decodeURIComponent(cookie.slice(COOKIE_NAME.length+1));
  }
  return "";
}
function sessionCookie(token,maxAge){
  return COOKIE_NAME+"="+encodeURIComponent(token)+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+Math.max(60,Number(maxAge||43200));
}
function clearSessionCookie(){
  return COOKIE_NAME+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
async function authRequest(path,{method="GET",body=null,token=""}={}){
  const response=await fetch(AUTH_URL+path,{
    method,
    headers:{
      "accept":"application/json",
      ...(body!=null?{"content-type":"application/json"}:{}),
      ...(token?{"authorization":"Bearer "+token}:{})
    },
    body:body==null?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(7000)
  });
  const payload=await response.json().catch(()=>({error:"AUTH_INVALID_JSON"}));
  return {response,payload};
}
async function accountForRequest(req){
  const token=cookieToken(req);
  if(!token) return null;
  const result=await authRequest("/v1/me",{token});
  if(!result.response.ok) return null;
  return {token,user:result.payload.user};
}
function today(){
  return new Date().toISOString().slice(0,10);
}
function usageFor(userId){
  const row=usageDb.prepare("SELECT requests,input_tokens,output_tokens FROM usage_daily WHERE user_id=? AND day=?").get(userId,today());
  return {
    day:today(),
    requests:Number(row?.requests||0),
    inputTokens:Number(row?.input_tokens||0),
    outputTokens:Number(row?.output_tokens||0),
    dailyRequestLimit:FREE_DAILY_REQUESTS||null,
    fairUse:FREE_DAILY_REQUESTS===0
  };
}
function recordUsage(userId,payload,messages){
  const input=Number(payload?.usage?.prompt_tokens||payload?.usage?.input_tokens||0) || Math.ceil(messages.reduce((n,m)=>n+String(m.content||"").length,0)/4);
  const output=Number(payload?.usage?.completion_tokens||payload?.usage?.output_tokens||0) || Math.ceil(String(payload?.choices?.[0]?.message?.content||"").length/4);
  usageDb.prepare(`
    INSERT INTO usage_daily(user_id,day,requests,input_tokens,output_tokens)
    VALUES(?,?,1,?,?)
    ON CONFLICT(user_id,day) DO UPDATE SET
      requests=usage_daily.requests+1,
      input_tokens=usage_daily.input_tokens+excluded.input_tokens,
      output_tokens=usage_daily.output_tokens+excluded.output_tokens,
      updated_at=datetime('now')
  `).run(userId,today(),input,output);
}
function publicEntitlement(userId){
  const usage=usageFor(userId);
  return {
    plan:"free-pilot",
    chat:true,
    dailyRequestLimit:usage.dailyRequestLimit,
    fairUse:usage.fairUse,
    note:usage.fairUse?"No artificial daily message cap is configured; real capacity and abuse protections still apply.":"Daily request allowance is capacity-controlled.",
    usage
  };
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
    if(req.method==="GET"&&url.pathname==="/"){
      return html(res,200,PUBLIC_INDEX);
    }
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
    if(req.method==="GET"&&url.pathname==="/v1/public-products"){
      return json(res,200,{
        product:"IZAKHONO ONE",
        updated_at:ROLLOUT.updated_at,
        pricing_policy:"Target lower than directly comparable Microsoft/Google paid plans",
        artificial_limits_avoided:true,
        products:publicProducts()
      });
    }
    if(req.method==="GET" && (url.pathname==="/account/verify" || url.pathname==="/account/reset")){
      return html(res,200,PUBLIC_INDEX);
    }

    if(req.method==="POST" && url.pathname==="/v1/account/register"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const body=await readJson(req);
      const result=await authRequest("/v1/register",{method:"POST",body});
      return json(res,result.response.status,result.payload);
    }

    if(req.method==="POST" && url.pathname==="/v1/account/verify"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const body=await readJson(req);
      const result=await authRequest("/v1/verify-email",{method:"POST",body});
      return json(res,result.response.status,result.payload);
    }

    if(req.method==="POST" && url.pathname==="/v1/account/login"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const body=await readJson(req);
      const result=await authRequest("/v1/login",{method:"POST",body});
      if(!result.response.ok) return json(res,result.response.status,result.payload);
      const token=result.payload?.token;
      if(!token) return json(res,502,{error:"AUTH_SESSION_MISSING"});
      return json(res,200,{user:result.payload.user,expiresInSeconds:result.payload.expiresInSeconds},{
        "set-cookie":sessionCookie(token,result.payload.expiresInSeconds)
      });
    }

    if(req.method==="GET" && url.pathname==="/v1/account/me"){
      const account=await accountForRequest(req);
      if(!account) return json(res,401,{error:"Authentication required"});
      return json(res,200,{user:account.user,entitlement:publicEntitlement(account.user.id)});
    }

    if(req.method==="POST" && url.pathname==="/v1/account/logout"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const token=cookieToken(req);
      if(token) await authRequest("/v1/logout",{method:"POST",body:{},token}).catch(()=>null);
      return json(res,200,{loggedOut:true},{"set-cookie":clearSessionCookie()});
    }

    if(req.method==="POST" && url.pathname==="/v1/account/recovery/request"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const body=await readJson(req);
      const result=await authRequest("/v1/recovery/request",{method:"POST",body});
      return json(res,result.response.status,result.payload);
    }

    if(req.method==="POST" && url.pathname==="/v1/account/recovery/reset"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const body=await readJson(req);
      const result=await authRequest("/v1/recovery/reset",{method:"POST",body});
      return json(res,result.response.status,result.payload);
    }

    if(req.method==="GET" && url.pathname==="/v1/account/usage"){
      const account=await accountForRequest(req);
      if(!account) return json(res,401,{error:"Authentication required"});
      return json(res,200,{entitlement:publicEntitlement(account.user.id)});
    }

    if(req.method==="POST" && url.pathname==="/v1/one/chat"){
      if(!sameOrigin(req)) return json(res,403,{error:"Origin not allowed"});
      const account=await accountForRequest(req);
      if(!account) return json(res,401,{error:"Authentication required"});
      if(!Array.isArray(account.user.permissions) || !account.user.permissions.includes("one.ai.chat")) return json(res,403,{error:"AI chat is not enabled for this account"});
      const current=usageFor(account.user.id);
      if(FREE_DAILY_REQUESTS>0 && current.requests>=FREE_DAILY_REQUESTS) return json(res,429,{error:"Daily fair-use allowance reached",entitlement:publicEntitlement(account.user.id)});
      const body=await readJson(req);
      const messages=normalizeMessages(body.messages);
      const payload=await chat({...body,messages});
      recordUsage(account.user.id,payload,messages);
      return json(res,200,{...payload,entitlement:publicEntitlement(account.user.id)});
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

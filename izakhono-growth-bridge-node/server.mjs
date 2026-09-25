import http from "node:http";
import {appendFileSync,mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {assertClaims,mapRoute,oidcConfig} from "./policy.mjs";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8920);
const AUTH_URL=(process.env.IZAKHONO_AUTH_URL||"http://127.0.0.1:8820").replace(/\/$/,"");
const DATA_URL=(process.env.IZAKHONO_DATA_URL||"http://127.0.0.1:8787").replace(/\/$/,"");
const DATA_KEY=process.env.IZAKHONO_DATA_KEY||"";
const PAY_URL=(process.env.IZAKHONO_PAY_URL||"http://127.0.0.1:18100").replace(/\/$/,"");
const PAY_APP_KEY=process.env.IZAKHONO_PAY_GROWTH_OS_KEY||"";
const MAX_BODY=128*1024;
const LOG=process.env.IZAKHONO_GROWTH_BRIDGE_LOG||"/var/log/izakhono/growth-bridge-access.jsonl";
const c=oidcConfig();
const JWKS=createRemoteJWKSet(new URL(`${c.issuer}/.well-known/jwks`));

if(!["127.0.0.1","localhost"].includes(HOST)) throw new Error("Bridge refuses non-loopback bind");
mkdirSync(dirname(LOG),{recursive:true});

function safeLog(entry){
  try{appendFileSync(LOG,JSON.stringify({...entry,at:new Date().toISOString()})+"\n");}catch{}
}
function json(res,status,value){
  const raw=Buffer.from(JSON.stringify(value));
  res.writeHead(status,{
    "content-type":"application/json",
    "content-length":raw.length,
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"
  });
  res.end(raw);
}
async function readBody(req){
  const declared=Number(req.headers["content-length"]||0);
  if(declared>MAX_BODY) throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});
  const chunks=[];let n=0;
  for await(const chunk of req){
    n+=chunk.length;
    if(n>MAX_BODY) throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function verifyCaller(req){
  const auth=String(req.headers.authorization||"");
  if(!auth.startsWith("Bearer ")) throw Object.assign(new Error("OIDC_REQUIRED"),{status:401});
  const token=auth.slice(7).trim();
  const {payload}=await jwtVerify(token,JWKS,{
    issuer:c.issuer,
    audience:c.audience,
    subject:c.subject,
    algorithms:["RS256"]
  });
  assertClaims(payload);
  return payload;
}
async function fetchJsonHealth(url){
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(3500),cache:"no-store"});
    const body=await r.json().catch(()=>({}));
    return {reachable:r.ok,status:r.status,body};
  }catch{return {reachable:false,status:null,body:{}};}
}
async function health(){
  const [auth,data,pay]=await Promise.all([
    fetchJsonHealth(AUTH_URL+"/health"),
    fetchJsonHealth(DATA_URL+"/health"),
    fetchJsonHealth(PAY_URL+"/health")
  ]);
  return {
    ok:true,
    service:"izakhono-growth-bridge",
    runtime:"izakhono-owned",
    bind:"loopback",
    oidc:{
      issuer:c.issuer,
      audience:c.audience,
      subject:c.subject,
      project_id:c.projectId,
      team_id:c.teamId
    },
    modules:{
      auth:{reachable:auth.reachable},
      data:{reachable:data.reachable,keyReady:Boolean(DATA_KEY)},
      payments:{
        reachable:pay.reachable,
        provider:pay.body?.primary_provider||null,
        growthOsRegistered:Boolean(PAY_APP_KEY)
      }
    },
    arbitraryProxy:false,
    shellAccess:false,
    secretsReturned:false
  };
}
async function proxy(req,res,route,url){
  const base=route.upstream==="auth"?AUTH_URL:route.upstream==="data"?DATA_URL:PAY_URL;
  if(route.internalKey && !DATA_KEY) return json(res,503,{error:"OWNED_DATA_KEY_NOT_READY"});
  if(route.payKey && !PAY_APP_KEY) return json(res,503,{error:"GROWTH_OS_PAYMENT_REGISTRATION_NOT_READY"});
  const headers=new Headers();
  const ct=req.headers["content-type"];
  if(ct) headers.set("content-type",String(ct));
  if(route.forwardAuthorization && req.headers["x-growth-session"]){
    headers.set("authorization",`Bearer ${String(req.headers["x-growth-session"])}`);
  }
  if(route.internalKey) headers.set("x-izakhono-key",DATA_KEY);
  if(route.payKey){
    headers.set("x-izakhono-app","growth-os");
    headers.set("x-izakhono-key",PAY_APP_KEY);
  }
  const body=["POST","PUT","PATCH"].includes(req.method||"")?await readBody(req):undefined;
  const upstream=await fetch(base+route.path,{
    method:req.method,
    headers,
    body,
    cache:"no-store",
    signal:AbortSignal.timeout(12000),
    redirect:"manual"
  });
  const raw=Buffer.from(await upstream.arrayBuffer());
  const outHeaders={
    "content-type":upstream.headers.get("content-type")||"application/json",
    "content-length":String(raw.length),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "x-izakhono-bridge":"1"
  };
  res.writeHead(upstream.status,outHeaders);
  res.end(raw);
}

const server=http.createServer(async(req,res)=>{
  const started=Date.now();
  const url=new URL(req.url||"/","http://localhost");
  let status=500;
  try{
    if(req.method==="GET" && url.pathname==="/health"){
      status=200;
      return json(res,200,await health());
    }
    if(["TRACE","CONNECT"].includes((req.method||"GET").toUpperCase())){
      status=405;return json(res,405,{error:"METHOD_BLOCKED"});
    }
    const caller=await verifyCaller(req);
    const route=mapRoute(req.method,url.pathname,url.search);
    if(!route){status=404;return json(res,404,{error:"ROUTE_NOT_ALLOWED"});}
    await proxy(req,res,route,url);
    status=res.statusCode||200;
    safeLog({method:req.method,path:url.pathname,status,durationMs:Date.now()-started,project_id:caller.project_id,environment:caller.environment});
  }catch(error){
    status=Number(error?.status||((error?.code||"").startsWith("ERR_JWT")?401:500));
    if(error?.code==="ERR_JWS_SIGNATURE_VERIFICATION_FAILED"||error?.code==="ERR_JWT_CLAIM_VALIDATION_FAILED"||error?.code==="ERR_JWT_EXPIRED") status=401;
    safeLog({method:req.method,path:url.pathname,status,durationMs:Date.now()-started,error:String(error?.message||"error").slice(0,120)});
    if(!res.headersSent) json(res,status,{error:status===401?"UNAUTHORIZED":String(error?.message||"BRIDGE_ERROR")});
    else res.end();
  }
});
server.listen(PORT,HOST,()=>console.log(`IZAKHONO Growth Bridge: http://${HOST}:${PORT}`));

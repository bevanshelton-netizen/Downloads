import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";

const INGRESS_MODE=(process.env.IZAKHONO_EDGE_MODE || "direct").toLowerCase();
const HTTP_HOST=process.env.HTTP_HOST || "0.0.0.0";
const HTTP_PORT=Number(process.env.HTTP_PORT || 80);
const TUNNEL_HOST=process.env.TUNNEL_HOST || "127.0.0.1";
const TUNNEL_PORT=Number(process.env.TUNNEL_PORT || 8780);
const HTTPS_HOST=process.env.HTTPS_HOST || "0.0.0.0";
const HTTPS_PORT=Number(process.env.HTTPS_PORT || 443);
const CONTROL_HOST=process.env.CONTROL_HOST || "127.0.0.1";
const CONTROL_PORT=Number(process.env.CONTROL_PORT || 8795);
const CONTROL_KEY=process.env.IZAKHONO_EDGE_KEY || "";
const RUNTIME_HOST=process.env.RUNTIME_HOST || "127.0.0.1";
const RUNTIME_PORT=Number(process.env.RUNTIME_PORT || 8080);
const TLS_CERT=resolve(process.env.IZAKHONO_TLS_CERT || "/etc/izakhono/tls/fullchain.pem");
const TLS_KEY=resolve(process.env.IZAKHONO_TLS_KEY || "/etc/izakhono/tls/privkey.pem");
const ACCESS_LOG=resolve(process.env.IZAKHONO_EDGE_ACCESS_LOG || "./logs/access.jsonl");
const MAX_BODY=Number(process.env.IZAKHONO_EDGE_MAX_BODY_BYTES || 5*1024*1024);
const RATE_PER_MIN=Number(process.env.IZAKHONO_EDGE_RATE_PER_MIN || 180);
const RATE_BURST=Number(process.env.IZAKHONO_EDGE_RATE_BURST || 60);
const FORTRESS_PROTECTOR=process.env.FORTRESS_PROTECTOR_MODE !== "off";
const FORTRESS_SENSITIVE_RATE_PER_MIN=Number(process.env.FORTRESS_SENSITIVE_RATE_PER_MIN || 60);
const FORTRESS_SENSITIVE_BURST=Number(process.env.FORTRESS_SENSITIVE_BURST || 20);
const FORTRESS_SENSITIVE_MAX_BODY=Number(process.env.FORTRESS_SENSITIVE_MAX_BODY_BYTES || 256*1024);

mkdirSync(dirname(ACCESS_LOG),{recursive:true});

const buckets=new Map();
const fortressBuckets=new Map();

function secureEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}

function clientIp(req){
  if(INGRESS_MODE==="tunnel"){
    const cf=req.headers["cf-connecting-ip"];
    if(typeof cf==="string" && /^[0-9a-f:.]+$/i.test(cf)) return cf;
  }
  return req.socket.remoteAddress || "unknown";
}

function normalizedHost(req){
  const host=(req.headers.host||"").trim().toLowerCase().split(":")[0];
  if(!host || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

function consumeBucket(store,key,ratePerMin,burst){
  const now=Date.now();
  const refillPerMs=ratePerMin/60000;
  const current=store.get(key) || {tokens:burst,at:now};
  current.tokens=Math.min(burst,current.tokens+(now-current.at)*refillPerMs);
  current.at=now;
  if(current.tokens<1){
    store.set(key,current);
    return false;
  }
  current.tokens-=1;
  store.set(key,current);
  return true;
}

function rateAllowed(req,host){
  return consumeBucket(buckets,clientIp(req)+"|"+host,RATE_PER_MIN,RATE_BURST);
}

function fortressSensitivePath(path){
  return path==="/api/v1/orders"
    || path.startsWith("/api/v1/orders/")
    || path.startsWith("/api/v1/providers/")
    || path.startsWith("/api/ikhokha")
    || path.startsWith("/api/izakhono-pay")
    || path.startsWith("/api/payfast");
}

function fortressJsonWritePath(path){
  return path==="/api/v1/orders"
    || path.startsWith("/api/v1/providers/ikhokha/")
    || path.startsWith("/api/ikhokha");
}

function fortressAllowed(req,host,path){
  if(!FORTRESS_PROTECTOR || !fortressSensitivePath(path)) return true;
  return consumeBucket(
    fortressBuckets,
    clientIp(req)+"|"+host+"|payment",
    FORTRESS_SENSITIVE_RATE_PER_MIN,
    FORTRESS_SENSITIVE_BURST
  );
}

function cleanupBuckets(){
  const stale=Date.now()-10*60*1000;
  for(const [key,value] of buckets){
    if(value.at<stale) buckets.delete(key);
  }
  for(const [key,value] of fortressBuckets){
    if(value.at<stale) fortressBuckets.delete(key);
  }
}
setInterval(cleanupBuckets,60_000).unref();

function securityHeaders(res){
  res.setHeader("x-content-type-options","nosniff");
  res.setHeader("referrer-policy","strict-origin-when-cross-origin");
  res.setHeader("permissions-policy","camera=(), microphone=(), geolocation=()");
  res.setHeader("strict-transport-security","max-age=31536000; includeSubDomains");
  res.setHeader("x-izakhono-edge","1");
  res.setHeader("x-fortress-protector",FORTRESS_PROTECTOR?"active":"off");
}

function logAccess(entry){
  try{appendFileSync(ACCESS_LOG,JSON.stringify({...entry,at:new Date().toISOString()})+"\n");}catch{}
}

function send(res,status,body,headers={}){
  const payload=Buffer.from(body);
  res.writeHead(status,{"content-type":"text/plain; charset=utf-8","content-length":payload.length,...headers});
  res.end(payload);
}

function proxy(req,res){
  const started=Date.now();
  const host=normalizedHost(req);
  if(!host){
    securityHeaders(res);
    logAccess({ip:clientIp(req),host:null,method:req.method,path:req.url,status:400,durationMs:Date.now()-started});
    return send(res,400,"IZAKHONO EDGE: invalid host");
  }

  const path=(req.url||"/").split("?")[0];

  if(["TRACE","CONNECT"].includes((req.method||"GET").toUpperCase())){
    securityHeaders(res);
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:405,fortress:true,durationMs:Date.now()-started});
    return send(res,405,"FORTRESS: method blocked");
  }

  if(!rateAllowed(req,host)){
    securityHeaders(res);
    res.setHeader("retry-after","60");
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:429,durationMs:Date.now()-started});
    return send(res,429,"IZAKHONO EDGE: rate limit exceeded");
  }

  if(!fortressAllowed(req,host,path)){
    securityHeaders(res);
    res.setHeader("retry-after","60");
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:429,fortress:true,durationMs:Date.now()-started});
    return send(res,429,"FORTRESS: sensitive-route rate limit exceeded");
  }

  const declared=Number(req.headers["content-length"] || 0);
  if(declared>MAX_BODY){
    securityHeaders(res);
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:413,durationMs:Date.now()-started});
    return send(res,413,"IZAKHONO EDGE: request body too large");
  }

  if(FORTRESS_PROTECTOR && fortressSensitivePath(path) && declared>FORTRESS_SENSITIVE_MAX_BODY){
    securityHeaders(res);
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:413,fortress:true,durationMs:Date.now()-started});
    return send(res,413,"FORTRESS: sensitive request body too large");
  }

  if(
    FORTRESS_PROTECTOR
    && ["POST","PUT","PATCH"].includes((req.method||"").toUpperCase())
    && fortressJsonWritePath(path)
    && !(req.headers["content-type"]||"").toLowerCase().startsWith("application/json")
  ){
    securityHeaders(res);
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:415,fortress:true,durationMs:Date.now()-started});
    return send(res,415,"FORTRESS: JSON content type required");
  }

  const headers={...req.headers,host};
  delete headers["connection"];
  delete headers["proxy-connection"];
  headers["x-forwarded-proto"]="https";
  headers["x-forwarded-host"]=host;
  headers["x-forwarded-for"]=clientIp(req);

  const upstream=httpRequest({
    hostname:RUNTIME_HOST,
    port:RUNTIME_PORT,
    method:req.method,
    path:req.url,
    headers
  },upstreamRes=>{
    const responseHeaders={...upstreamRes.headers};
    delete responseHeaders["connection"];
    for(const [name,value] of Object.entries(responseHeaders)){
      if(value!==undefined) res.setHeader(name,value);
    }
    securityHeaders(res);
    res.writeHead(upstreamRes.statusCode||502);
    upstreamRes.pipe(res);
    upstreamRes.on("end",()=>{
      logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:upstreamRes.statusCode||502,durationMs:Date.now()-started});
    });
  });

  upstream.on("error",()=>{
    if(!res.headersSent){
      securityHeaders(res);
      send(res,502,"IZAKHONO EDGE: runtime unavailable");
    }else{
      res.end();
    }
    logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:502,durationMs:Date.now()-started});
  });

  let received=0;
  req.on("data",chunk=>{
    received+=chunk.length;
    if(received>MAX_BODY){
      upstream.destroy();
      if(!res.headersSent){
        securityHeaders(res);
        send(res,413,"IZAKHONO EDGE: request body too large");
      }
      req.destroy();
      logAccess({ip:clientIp(req),host,method:req.method,path:req.url,status:413,durationMs:Date.now()-started});
      return;
    }
    if(!upstream.destroyed) upstream.write(chunk);
  });
  req.on("end",()=>{if(!upstream.destroyed) upstream.end();});
  req.on("error",()=>upstream.destroy());
}

function loadTls(){
  return {cert:readFileSync(TLS_CERT),key:readFileSync(TLS_KEY),minVersion:"TLSv1.2"};
}

let httpsServer=null;
let httpServer=null;
let tunnelServer=null;

if(INGRESS_MODE==="tunnel"){
  tunnelServer=createHttpServer(proxy);
  tunnelServer.listen(TUNNEL_PORT,TUNNEL_HOST,()=>console.log(`IZAKHONO EDGE tunnel origin: http://${TUNNEL_HOST}:${TUNNEL_PORT}`));
}else{
  httpsServer=createHttpsServer(loadTls(),proxy);
  httpServer=createHttpServer((req,res)=>{
    const host=normalizedHost(req);
    if(!host) return send(res,400,"IZAKHONO EDGE: invalid host");
    const port=HTTPS_PORT===443?"":":"+HTTPS_PORT;
    const location="https://"+host+port+(req.url||"/");
    res.writeHead(308,{location,"cache-control":"no-store"});
    res.end();
  });
  httpsServer.listen(HTTPS_PORT,HTTPS_HOST,()=>console.log(`IZAKHONO EDGE HTTPS: ${HTTPS_HOST}:${HTTPS_PORT}`));
  httpServer.listen(HTTP_PORT,HTTP_HOST,()=>console.log(`IZAKHONO EDGE HTTP redirect: ${HTTP_HOST}:${HTTP_PORT}`));
}

const control=createHttpServer((req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  if(req.method==="GET" && url.pathname==="/health"){
    const payload=JSON.stringify({
      product:"IZAKHONO EDGE NODE",
      status:"healthy",
      runtimeUpstream:`${RUNTIME_HOST}:${RUNTIME_PORT}`,
      tls:INGRESS_MODE!=="tunnel",
      ingressMode:INGRESS_MODE,
      tunnelOrigin:INGRESS_MODE==="tunnel"?`http://${TUNNEL_HOST}:${TUNNEL_PORT}`:null,
      rateLimitPerMinute:RATE_PER_MIN,
      maxBodyBytes:MAX_BODY,
      fortressProtector:FORTRESS_PROTECTOR,
      fortressSensitiveRatePerMinute:FORTRESS_SENSITIVE_RATE_PER_MIN,
      fortressSensitiveMaxBodyBytes:FORTRESS_SENSITIVE_MAX_BODY,
      thirdPartyEdgeRequired:false
    });
    res.writeHead(200,{"content-type":"application/json","content-length":Buffer.byteLength(payload),"cache-control":"no-store"});
    return res.end(payload);
  }

  if(!CONTROL_KEY || !secureEqual(req.headers["x-izakhono-key"],CONTROL_KEY)){
    return send(res,401,"Unauthorized");
  }

  if(req.method==="POST" && url.pathname==="/v1/reload-tls"){
    if(INGRESS_MODE==="tunnel" || !httpsServer) return send(res,409,"TLS is terminated by the configured tunnel ingress");
    try{
      httpsServer.setSecureContext(loadTls());
      return send(res,200,"TLS reloaded");
    }catch(error){
      console.error(error);
      return send(res,500,"TLS reload failed");
    }
  }

  return send(res,404,"Not found");
});

control.listen(CONTROL_PORT,CONTROL_HOST,()=>console.log(`IZAKHONO EDGE control: ${CONTROL_HOST}:${CONTROL_PORT}`));

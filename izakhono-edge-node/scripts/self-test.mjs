import { createServer } from "node:http";
import { spawn,execFileSync } from "node:child_process";
import { mkdirSync,rmSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const root=resolve("./.self-test");
const tls=resolve(root,"tls");
const logs=resolve(root,"access.jsonl");
const httpPort=19280;
const httpsPort=19243;
const controlPort=19295;
const runtimePort=19200;
const key=randomBytes(24).toString("hex");

rmSync(root,{recursive:true,force:true});
mkdirSync(tls,{recursive:true});

execFileSync("openssl",[
  "req","-x509","-newkey","rsa:2048","-nodes",
  "-keyout",resolve(tls,"key.pem"),
  "-out",resolve(tls,"cert.pem"),
  "-days","1",
  "-subj","/CN=demo.local",
  "-addext","subjectAltName=DNS:demo.local"
],{stdio:"ignore"});

const runtime=createServer((req,res)=>{
  res.writeHead(200,{"content-type":"text/plain","x-runtime-host":req.headers.host||""});
  res.end("runtime-ok");
});
await new Promise(resolve=>runtime.listen(runtimePort,"127.0.0.1",resolve));

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HTTP_HOST:"127.0.0.1",
    HTTP_PORT:String(httpPort),
    HTTPS_HOST:"127.0.0.1",
    HTTPS_PORT:String(httpsPort),
    CONTROL_HOST:"127.0.0.1",
    CONTROL_PORT:String(controlPort),
    RUNTIME_HOST:"127.0.0.1",
    RUNTIME_PORT:String(runtimePort),
    IZAKHONO_EDGE_KEY:key,
    IZAKHONO_TLS_CERT:resolve(tls,"cert.pem"),
    IZAKHONO_TLS_KEY:resolve(tls,"key.pem"),
    IZAKHONO_EDGE_ACCESS_LOG:logs,
    IZAKHONO_EDGE_RATE_PER_MIN:"2",
    IZAKHONO_EDGE_RATE_BURST:"2",
    IZAKHONO_EDGE_MAX_BODY_BYTES:"128",
    FORTRESS_PROTECTOR_MODE:"active",
    FORTRESS_SENSITIVE_RATE_PER_MIN:"1",
    FORTRESS_SENSITIVE_BURST:"1",
    FORTRESS_SENSITIVE_MAX_BODY_BYTES:"64"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitHealth(){
  for(let i=0;i<30;i++){
    await sleep(120);
    try{
      const r=await fetch(`http://127.0.0.1:${controlPort}/health`);
      if(r.ok) return;
    }catch{}
  }
  throw new Error("Edge health did not become ready");
}

function secureRequest({path="/",method="GET",host="demo.local",headers={},body=""}={}){
  return new Promise((resolve,reject)=>{
    const payload=Buffer.from(body);
    const requestHeaders={Host:host,...headers};
    if(payload.length>0 && requestHeaders["content-length"]==null && requestHeaders["Content-Length"]==null){
      requestHeaders["content-length"]=String(payload.length);
    }
    const req=httpsRequest({
      hostname:"127.0.0.1",
      port:httpsPort,
      path,
      method,
      servername:"demo.local",
      rejectUnauthorized:false,
      headers:requestHeaders
    },res=>{
      const chunks=[];
      res.on("data",chunk=>chunks.push(chunk));
      res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString("utf8")}));
    });
    req.on("error",reject);
    if(payload.length) req.write(payload);
    req.end();
  });
}

function secureGet(path="/"){
  return secureRequest({path});
}

try{
  await waitHealth();

  const redirect=await fetch(`http://127.0.0.1:${httpPort}/hello`,{
    redirect:"manual",
    headers:{host:"demo.local"}
  });
  if(redirect.status!==308) throw new Error("HTTP redirect failed");

  const first=await secureGet("/");
  if(first.status!==200 || first.body!=="runtime-ok") throw new Error("HTTPS proxy failed");
  if(first.headers["x-izakhono-edge"]!=="1") throw new Error("Edge header missing");
  if(first.headers["strict-transport-security"]==null) throw new Error("HSTS missing");

  const second=await secureGet("/second");
  if(second.status!==200) throw new Error("Second request unexpectedly failed");

  const limited=await secureGet("/third");
  if(limited.status!==429) throw new Error("Rate limit test failed: "+limited.status);

  const protectedFirst=await secureRequest({
    path:"/api/ikhokha/webhook",
    method:"POST",
    host:"payments.local",
    headers:{"content-type":"application/json"},
    body:"{}"
  });
  if(protectedFirst.status!==200) throw new Error("FORTRESS protected payment request failed: "+protectedFirst.status);
  if(protectedFirst.headers["x-fortress-protector"]!=="active") throw new Error("FORTRESS response header missing");

  const protectedLimited=await secureRequest({
    path:"/api/ikhokha/webhook",
    method:"POST",
    host:"payments.local",
    headers:{"content-type":"application/json"},
    body:"{}"
  });
  if(protectedLimited.status!==429 || !protectedLimited.body.includes("FORTRESS")) {
    throw new Error("FORTRESS sensitive-route limit failed: "+protectedLimited.status);
  }

  const protectedOversize=await secureRequest({
    path:"/api/v1/orders",
    method:"POST",
    host:"oversize.local",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({payload:"x".repeat(80)})
  });
  if(protectedOversize.status!==413 || !protectedOversize.body.includes("FORTRESS")) {
    throw new Error("FORTRESS sensitive body limit failed: "+protectedOversize.status);
  }

  const protectedType=await secureRequest({
    path:"/api/v1/orders",
    method:"POST",
    host:"type.local",
    body:"{}"
  });
  if(protectedType.status!==415 || !protectedType.body.includes("FORTRESS")) {
    throw new Error("FORTRESS content-type guard failed: "+protectedType.status);
  }

  const blockedMethod=await secureRequest({path:"/",method:"TRACE",host:"method.local"});
  if(blockedMethod.status!==405 || !blockedMethod.body.includes("FORTRESS")) {
    throw new Error("FORTRESS method guard failed: "+blockedMethod.status);
  }

  console.log("IZAKHONO EDGE NODE + FORTRESS PROTECTOR SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  runtime.close();
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}

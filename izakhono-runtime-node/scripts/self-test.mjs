import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { mkdirSync,rmSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const root=resolve("./.self-test");
const releases=resolve(root,"releases");
const logs=resolve(root,"logs");
const data=resolve(root,"runtime.sqlite");
const envRoot=resolve(root,"env");
const controlPort=19190;
const proxyPort=19180;
const key=randomBytes(24).toString("hex");

rmSync(root,{recursive:true,force:true});
mkdirSync(resolve(releases,"demo","r1"),{recursive:true});
mkdirSync(resolve(releases,"demo","r2"),{recursive:true});
mkdirSync(envRoot,{recursive:true});

const app=(version)=>`import {createServer} from "node:http";
createServer((req,res)=>{
  if(req.url==="/health"){res.writeHead(200);return res.end("ok");}
  res.writeHead(200,{"content-type":"text/plain"});res.end("${version}");
}).listen(Number(process.env.PORT),"127.0.0.1");`;

writeFileSync(resolve(releases,"demo","r1","server.mjs"),app("v1"));
writeFileSync(resolve(releases,"demo","r2","server.mjs"),app("v2"));

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    CONTROL_HOST:"127.0.0.1",
    CONTROL_PORT:String(controlPort),
    PROXY_HOST:"127.0.0.1",
    PROXY_PORT:String(proxyPort),
    IZAKHONO_RUNTIME_KEY:key,
    IZAKHONO_RELEASE_ROOT:releases,
    IZAKHONO_RUNTIME_DB:data,
    IZAKHONO_RUNTIME_LOG_ROOT:logs,
    IZAKHONO_ENV_ROOT:envRoot,
    IZAKHONO_APP_PORT_START:"19300"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(150);
    try{
      const r=await fetch(`http://127.0.0.1:${controlPort}/health`);
      if(r.ok) return;
    }catch{}
  }
  throw new Error("Runtime node did not become healthy");
}

async function deploy(path){
  const response=await fetch(`http://127.0.0.1:${controlPort}/v1/deployments`,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":key},
    body:JSON.stringify({
      app:"demo",
      hostname:"demo.local",
      releasePath:path,
      command:["node","server.mjs"],
      healthPath:"/health"
    })
  });
  if(!response.ok) throw new Error("Deploy failed: "+await response.text());
}

async function routed(host="demo.local"){
  return new Promise((resolve,reject)=>{
    const req=httpRequest({
      hostname:"127.0.0.1",
      port:proxyPort,
      path:"/",
      method:"GET",
      headers:{Host:host}
    },res=>{
      const chunks=[];
      res.on("data",chunk=>chunks.push(chunk));
      res.on("end",()=>{
        if((res.statusCode||500)>=400) return reject(new Error("Proxy route failed: "+res.statusCode+" "+Buffer.concat(chunks).toString("utf8")));
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
    req.on("error",reject);
    req.end();
  });
}

try{
  await waitHealth();
  await deploy(resolve(releases,"demo","r1"));
  if(await routed()!=="v1") throw new Error("r1 route mismatch");

  const alias=await fetch(`http://127.0.0.1:${controlPort}/v1/apps/demo/aliases`,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":key},
    body:JSON.stringify({hostname:"bridge.example.ts.net"})
  });
  if(!alias.ok) throw new Error("Alias creation failed: "+await alias.text());
  if(await routed("bridge.example.ts.net")!=="v1") throw new Error("alias route mismatch");

  await deploy(resolve(releases,"demo","r2"));
  if(await routed()!=="v2") throw new Error("r2 route mismatch");
  if(await routed("bridge.example.ts.net")!=="v2") throw new Error("alias did not follow active deployment");

  const rollback=await fetch(`http://127.0.0.1:${controlPort}/v1/apps/demo/rollback`,{
    method:"POST",
    headers:{"x-izakhono-key":key}
  });
  if(!rollback.ok) throw new Error("Rollback failed: "+await rollback.text());
  if(await routed()!=="v1") throw new Error("rollback route mismatch");

  console.log("IZAKHONO RUNTIME NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(250);
  rmSync(root,{recursive:true,force:true});
}

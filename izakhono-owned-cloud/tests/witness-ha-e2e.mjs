import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.witness-ha-e2e");
const witnessPort=20130;
const runtimeControlPort=20131;
const runtimeProxyPort=20132;
const edgeTunnelPort=20133;
const edgeControlPort=20134;
const appPortStart=20200;

rmSync(root,{recursive:true,force:true});
mkdirSync(resolve(root,"witness-keys"),{recursive:true});
mkdirSync(resolve(root,"releases/demo/r1"),{recursive:true});
mkdirSync(resolve(root,"runtime-logs"),{recursive:true});
mkdirSync(resolve(root,"runtime-env"),{recursive:true});
mkdirSync(resolve(root,"edge-logs"),{recursive:true});

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const privateKeyFile=resolve(root,"witness-keys/private.pem");
const publicKeyFile=resolve(root,"witness-keys/public.pem");
writeFileSync(privateKeyFile,privateKey.export({type:"pkcs8",format:"pem"}));
writeFileSync(publicKeyFile,publicKey.export({type:"spki",format:"pem"}));

const adminKey=randomBytes(24).toString("hex");
const runtimeKey=randomBytes(24).toString("hex");
const edgeKey=randomBytes(24).toString("hex");
const witnessDb=resolve(root,"witness.sqlite");

const demoApp=`import {createServer} from "node:http";
createServer((req,res)=>{
  if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({status:"healthy"}));}
  res.writeHead(200,{"content-type":"text/plain"});
  res.end((req.method||"GET")+"-ok");
}).listen(Number(process.env.PORT),"127.0.0.1");`;
writeFileSync(resolve(root,"releases/demo/r1/server.mjs"),demoApp);

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const children=new Set();
const logs=new Map();

function spawnLogged(label,command,args,env){
  const child=spawn(command,args,{env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
  children.add(child);
  logs.set(label,"");
  const add=chunk=>{
    const current=logs.get(label)||"";
    logs.set(label,(current+chunk.toString()).slice(-12000));
  };
  child.stdout.on("data",add);
  child.stderr.on("data",add);
  child.on("exit",()=>children.delete(child));
  return child;
}

function spawnWitness(){
  return spawnLogged("witness",process.execPath,["izakhono-witness-node/server.mjs"],{
    NODE_ENV:"test",
    HOST:"127.0.0.1",
    PORT:String(witnessPort),
    IZAKHONO_WITNESS_ADMIN_KEY:adminKey,
    IZAKHONO_WITNESS_DB:witnessDb,
    IZAKHONO_WITNESS_PRIVATE_KEY_FILE:privateKeyFile,
    IZAKHONO_WITNESS_PUBLIC_KEY_FILE:publicKeyFile
  });
}

async function waitJson(url,predicate=()=>true,attempts=60,delay=100){
  let last;
  for(let i=0;i<attempts;i++){
    try{
      const r=await fetch(url,{cache:"no-store"});
      if(r.ok){
        const body=await r.json();
        last=body;
        if(predicate(body)) return body;
      }
    }catch{}
    await sleep(delay);
  }
  throw new Error("Timed out waiting for "+url+" last="+JSON.stringify(last));
}

async function jsonPost(url,body,headers={}){
  const r=await fetch(url,{
    method:"POST",
    headers:{"content-type":"application/json",...headers},
    body:JSON.stringify(body)
  });
  const payload=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error("POST "+url+" failed "+r.status+" "+JSON.stringify(payload));
  return payload;
}

function rawRequest({port,method="GET",path="/",host="demo.local",body=""}){
  return new Promise((resolvePromise,reject)=>{
    const payload=Buffer.from(body);
    const headers={Host:host};
    if(payload.length){
      headers["content-type"]="application/json";
      headers["content-length"]=String(payload.length);
    }
    const req=httpRequest({
      hostname:"127.0.0.1",
      port,
      method,
      path,
      headers
    },res=>{
      const chunks=[];
      res.on("data",c=>chunks.push(c));
      res.on("end",()=>resolvePromise({
        status:res.statusCode||0,
        headers:res.headers,
        body:Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.on("error",reject);
    if(payload.length) req.write(payload);
    req.end();
  });
}

let witness=null;
let runtime=null;
let edge=null;
let memberKey="";
let memberId="";
let clusterId="";

try{
  witness=spawnWitness();
  await waitJson(`http://127.0.0.1:${witnessPort}/health`,x=>x.product==="IZAKHONO WITNESS NODE");

  const cluster=await jsonPost(
    `http://127.0.0.1:${witnessPort}/v1/clusters`,
    {name:"ha-e2e",leaseTtlSeconds:1},
    {"x-izakhono-key":adminKey}
  );
  clusterId=cluster.cluster.id;

  const member=await jsonPost(
    `http://127.0.0.1:${witnessPort}/v1/clusters/${clusterId}/members`,
    {name:"primary"},
    {"x-izakhono-key":adminKey}
  );
  memberKey=member.memberKey;
  memberId=member.member.id;

  const witnessEnv={
    IZAKHONO_WITNESS_MODE:"enforce",
    IZAKHONO_WITNESS_URL:`http://127.0.0.1:${witnessPort}`,
    IZAKHONO_WITNESS_CLUSTER_ID:clusterId,
    IZAKHONO_WITNESS_MEMBER_ID:memberId,
    IZAKHONO_WITNESS_MEMBER_KEY:memberKey,
    IZAKHONO_WITNESS_PUBLIC_KEY_FILE:publicKeyFile,
    IZAKHONO_WITNESS_RENEW_MS:"250"
  };

  runtime=spawnLogged("runtime",process.execPath,["izakhono-runtime-node/server.mjs"],{
    CONTROL_HOST:"127.0.0.1",
    CONTROL_PORT:String(runtimeControlPort),
    PROXY_HOST:"127.0.0.1",
    PROXY_PORT:String(runtimeProxyPort),
    IZAKHONO_RUNTIME_KEY:runtimeKey,
    IZAKHONO_RELEASE_ROOT:resolve(root,"releases"),
    IZAKHONO_RUNTIME_DB:resolve(root,"runtime.sqlite"),
    IZAKHONO_RUNTIME_LOG_ROOT:resolve(root,"runtime-logs"),
    IZAKHONO_ENV_ROOT:resolve(root,"runtime-env"),
    IZAKHONO_APP_PORT_START:String(appPortStart),
    ...witnessEnv
  });

  await waitJson(`http://127.0.0.1:${runtimeControlPort}/health`,x=>x.product==="IZAKHONO RUNTIME NODE");

  await jsonPost(
    `http://127.0.0.1:${runtimeControlPort}/v1/deployments`,
    {
      app:"demo",
      hostname:"demo.local",
      releasePath:resolve(root,"releases/demo/r1"),
      command:["node","server.mjs"],
      healthPath:"/health"
    },
    {"x-izakhono-key":runtimeKey}
  );

  edge=spawnLogged("edge",process.execPath,["izakhono-edge-node/server.mjs"],{
    IZAKHONO_EDGE_MODE:"tunnel",
    TUNNEL_HOST:"127.0.0.1",
    TUNNEL_PORT:String(edgeTunnelPort),
    CONTROL_HOST:"127.0.0.1",
    CONTROL_PORT:String(edgeControlPort),
    RUNTIME_HOST:"127.0.0.1",
    RUNTIME_PORT:String(runtimeProxyPort),
    IZAKHONO_EDGE_KEY:edgeKey,
    IZAKHONO_EDGE_ACCESS_LOG:resolve(root,"edge-logs/access.jsonl"),
    IZAKHONO_EDGE_RATE_PER_MIN:"1000",
    IZAKHONO_EDGE_RATE_BURST:"1000",
    IZAKHONO_EDGE_MAX_BODY_BYTES:"1048576",
    FORTRESS_PROTECTOR_MODE:"active",
    FORTRESS_SENSITIVE_RATE_PER_MIN:"1000",
    FORTRESS_SENSITIVE_BURST:"1000",
    FORTRESS_SENSITIVE_MAX_BODY_BYTES:"1048576",
    ...witnessEnv
  });

  const edgeHealthy=await waitJson(
    `http://127.0.0.1:${edgeControlPort}/health`,
    x=>x.product==="IZAKHONO EDGE NODE" && x.ingressMode==="tunnel"
  );
  if(edgeHealthy.fortressProtector!==true) throw new Error("FORTRESS was not preserved in tunnel-mode HA proof");

  const leasedRuntime=await waitJson(
    `http://127.0.0.1:${runtimeControlPort}/health`,
    x=>x.witness?.configured===true && x.witness?.leaseValid===true && x.witness?.receiptVerified===true
  );
  const leasedEdge=await waitJson(
    `http://127.0.0.1:${edgeControlPort}/health`,
    x=>x.witness?.configured===true && x.witness?.leaseValid===true && x.witness?.receiptVerified===true
  );

  const firstToken=Number(leasedRuntime.witness.fencingToken);
  if(!Number.isInteger(firstToken) || firstToken<1) throw new Error("Invalid first fencing token");
  if(Number(leasedEdge.witness.fencingToken)!==firstToken) throw new Error("RUNTIME/EDGE fencing-token mismatch");

  let response=await rawRequest({port:edgeTunnelPort,method:"POST",path:"/write",body:"{}"});
  if(response.status!==200 || response.body!=="POST-ok") throw new Error("Write with valid witness lease failed: "+JSON.stringify(response));

  response=await rawRequest({port:edgeTunnelPort,method:"GET",path:"/read"});
  if(response.status!==200 || response.body!=="GET-ok") throw new Error("Read with valid witness lease failed");

  witness.kill("SIGTERM");
  await sleep(1500);

  const expiredRuntime=await waitJson(
    `http://127.0.0.1:${runtimeControlPort}/health`,
    x=>x.witness?.configured===true && x.witness?.leaseValid===false
  );
  const expiredEdge=await waitJson(
    `http://127.0.0.1:${edgeControlPort}/health`,
    x=>x.witness?.configured===true && x.witness?.leaseValid===false
  );
  if(expiredRuntime.witness.mode!=="enforce" || expiredEdge.witness.mode!=="enforce") throw new Error("Enforcement mode changed after witness loss");

  response=await rawRequest({port:edgeTunnelPort,method:"POST",path:"/write-after-loss",body:"{}"});
  if(response.status!==503 || !response.body.includes("witness leadership lease")) {
    throw new Error("Write did not fail closed after witness lease expiry: "+JSON.stringify(response));
  }

  response=await rawRequest({port:edgeTunnelPort,method:"GET",path:"/read-after-loss"});
  if(response.status!==200 || response.body!=="GET-ok") throw new Error("Read availability was lost with witness");

  witness=spawnWitness();
  await waitJson(`http://127.0.0.1:${witnessPort}/health`,x=>x.product==="IZAKHONO WITNESS NODE");

  const recoveredRuntime=await waitJson(
    `http://127.0.0.1:${runtimeControlPort}/health`,
    x=>x.witness?.leaseValid===true && Number(x.witness?.fencingToken)>firstToken,
    100,100
  );
  const recoveredEdge=await waitJson(
    `http://127.0.0.1:${edgeControlPort}/health`,
    x=>x.witness?.leaseValid===true && Number(x.witness?.fencingToken)===Number(recoveredRuntime.witness.fencingToken),
    100,100
  );

  const recoveredToken=Number(recoveredRuntime.witness.fencingToken);
  if(recoveredToken<=firstToken) throw new Error("Fencing token did not advance after lease loss");

  response=await rawRequest({port:edgeTunnelPort,method:"POST",path:"/write-recovered",body:"{}"});
  if(response.status!==200 || response.body!=="POST-ok") throw new Error("Write did not recover after witness return");

  console.log(JSON.stringify({
    product:"IZAKHONO WITNESS HA E2E",
    status:"PASS",
    fortressPreserved:true,
    initialFencingToken:firstToken,
    recoveredFencingToken:recoveredToken,
    writeWithLease:"PASS",
    writeAfterLeaseExpiry:"BLOCKED_503",
    readAfterLeaseExpiry:"PASS",
    writeAfterWitnessRecovery:"PASS",
    automaticDnsFailover:false
  },null,2));
}catch(error){
  console.error(error);
  for(const [label,content] of logs) console.error("\n--- "+label+" ---\n"+content);
  process.exitCode=1;
}finally{
  try{
    await fetch(`http://127.0.0.1:${runtimeControlPort}/v1/apps/demo/stop`,{
      method:"POST",
      headers:{"content-type":"application/json","x-izakhono-key":runtimeKey},
      body:"{}"
    });
  }catch{}
  for(const child of [edge,runtime,witness]){
    try{child?.kill("SIGTERM");}catch{}
  }
  await sleep(250);
  rmSync(root,{recursive:true,force:true});
}

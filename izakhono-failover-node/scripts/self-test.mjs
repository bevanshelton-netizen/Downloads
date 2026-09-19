import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const activePort=19920;
const standbyPort=19921;
const failoverPort=19922;
const key=randomBytes(24).toString("hex");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

function healthServer(port,label){
  const server=createServer((req,res)=>{
    if(req.url!=="/health"){res.writeHead(404);return res.end();}
    const body=JSON.stringify({product:"DEMO APP",status:"healthy",node:label});
    res.writeHead(200,{"content-type":"application/json","content-length":Buffer.byteLength(body)});
    res.end(body);
  });
  return new Promise(resolvePromise=>server.listen(port,"127.0.0.1",()=>resolvePromise(server)));
}

let active=await healthServer(activePort,"active");
const standby=await healthServer(standbyPort,"standby");

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    NODE_ENV:"test",
    HOST:"127.0.0.1",
    PORT:String(failoverPort),
    IZAKHONO_FAILOVER_KEY:key,
    IZAKHONO_FAILOVER_DB:resolve(root,"failover.sqlite"),
    IZAKHONO_FAILOVER_MONITOR_MS:"10000",
    IZAKHONO_FAILOVER_FAIL_SAMPLES:"3",
    IZAKHONO_FAILOVER_PROBE_TIMEOUT_MS:"300"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers={"x-izakhono-key":key,"content-type":"application/json"};

async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(100);
    try{const r=await fetch(`http://127.0.0.1:${failoverPort}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("Failover node did not become healthy");
}
async function post(path,body={}){
  const r=await fetch(`http://127.0.0.1:${failoverPort}${path}`,{method:"POST",headers,body:JSON.stringify(body)});
  return {r,body:await r.json()};
}

try{
  await waitHealth();

  let x=await post("/v1/services",{
    name:"demo",
    activeUrl:`http://127.0.0.1:${activePort}/health`,
    standbyUrl:`http://127.0.0.1:${standbyPort}/health`,
    expectedProduct:"DEMO APP",
    routeName:"demo.domains.izakhonoafrica.co.za"
  });
  if(x.r.status!==201) throw new Error("Service create failed");
  const id=x.body.service.id;

  x=await post(`/v1/services/${id}/probe`);
  if(x.body.service.state!=="healthy") throw new Error("Initial healthy state failed");

  await new Promise(resolvePromise=>active.close(resolvePromise));

  for(let i=0;i<3;i++) {
    x=await post(`/v1/services/${id}/probe`);
  }
  if(x.body.service.state!=="failover-candidate" || !x.body.proposal?.id) throw new Error("Failover candidate was not created");
  const proposalId=x.body.proposal.id;

  x=await post(`/v1/proposals/${proposalId}/approve`,{confirm:"PROMOTE",activeFenced:false});
  if(x.r.status!==409 || x.body.splitBrainRisk!==true) throw new Error("Unfenced promotion was not blocked");

  x=await post(`/v1/proposals/${proposalId}/approve`,{
    confirm:"PROMOTE",
    activeFenced:true,
    fenceEvidence:"primary power/network isolation confirmed",
    actor:"self-test"
  });
  if(!x.r.ok || x.body.automaticRouteChange!==false || x.body.execution!=="manual-route-switch-required") throw new Error("Fenced approval failed");

  x=await post(`/v1/proposals/${proposalId}/complete`,{
    confirm:"ROUTE_SWITCHED",
    routeEvidence:"test route changed to standby"
  });
  if(!x.r.ok || x.body.service.epoch!==1) throw new Error("Promotion completion failed");
  if(!x.body.service.active_url.includes(String(standbyPort))) throw new Error("Standby was not recorded as new active");

  const h=await fetch(`http://127.0.0.1:${failoverPort}/health`);
  const health=await h.json();
  if(health.automaticPromotion!==false || health.splitBrainProtection!=="fence-required") throw new Error("Safety posture missing");

  console.log("IZAKHONO FAILOVER NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  try{active.close();}catch{}
  try{standby.close();}catch{}
  await sleep(120);
  rmSync(root,{recursive:true,force:true});
}

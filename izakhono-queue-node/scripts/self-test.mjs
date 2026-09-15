import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const port=19510;
const key=randomBytes(24).toString("hex");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

const child=spawn(process.execPath,["server.mjs"],{
  env:{...process.env,HOST:"127.0.0.1",PORT:String(port),IZAKHONO_QUEUE_KEY:key,IZAKHONO_QUEUE_DB:resolve(root,"queue.sqlite")},
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers={"x-izakhono-key":key,"content-type":"application/json"};

async function waitHealth(){
  for(let i=0;i<30;i++){
    await sleep(120);
    try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("Queue node did not become healthy");
}
async function post(path,body){
  const r=await fetch(`http://127.0.0.1:${port}${path}`,{method:"POST",headers,body:JSON.stringify(body)});
  if(!r.ok) throw new Error(path+" failed: "+await r.text());
  return r.json();
}

try{
  await waitHealth();

  let x=await post("/v1/queues/growth/jobs",{uniqueKey:"demo-1",payload:{hello:"world"},maxAttempts:2});
  const id=x.job.id;

  x=await post("/v1/queues/growth/jobs",{uniqueKey:"demo-1",payload:{ignored:true}});
  if(x.created!==false || x.job.id!==id) throw new Error("Idempotent enqueue failed");

  x=await post("/v1/queues/growth/lease",{worker:"worker-a",leaseSeconds:10});
  if(x.job?.id!==id || x.job.attempts!==1) throw new Error("Lease failed");

  x=await post(`/v1/jobs/${id}/fail`,{worker:"worker-a",error:"retry me",retryDelaySeconds:0});
  if(x.job.state!=="queued") throw new Error("Retry failed");

  x=await post("/v1/queues/growth/lease",{worker:"worker-a",leaseSeconds:10});
  if(x.job?.id!==id || x.job.attempts!==2) throw new Error("Second lease failed");

  x=await post(`/v1/jobs/${id}/fail`,{worker:"worker-a",error:"dead now",retryDelaySeconds:0});
  if(x.job.state!=="dead") throw new Error("Dead-letter failed");

  x=await post("/v1/queues/growth/jobs",{payload:{recurring:true},repeatEverySeconds:60});
  const recurring=x.job.id;
  x=await post("/v1/queues/growth/lease",{worker:"worker-b"});
  if(x.job?.id!==recurring) throw new Error("Recurring lease failed");
  await post(`/v1/jobs/${recurring}/ack`,{worker:"worker-b"});

  const stats=await fetch(`http://127.0.0.1:${port}/v1/queues/growth/stats`,{headers:{"x-izakhono-key":key}});
  const s=await stats.json();
  if(!s.states.some(v=>v.state==="dead")) throw new Error("Stats/dead state missing");
  if(!s.states.some(v=>v.state==="done")) throw new Error("Stats/done state missing");
  if(!s.states.some(v=>v.state==="queued")) throw new Error("Recurring next job missing");

  console.log("IZAKHONO QUEUE NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(100);
  rmSync(root,{recursive:true,force:true});
}

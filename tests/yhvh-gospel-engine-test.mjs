import { mkdtemp, rm, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const dir=await mkdtemp(join(tmpdir(),"yhvh-gospel-engine-"));
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p))});s.on("error",reject)});
const token="ci-owner-engine-token-1234567890";
const child=spawn(process.execPath,["engines/yhvh-gospel-engine/engine.mjs"],{
  cwd:process.cwd(),
  env:{...process.env,HOST:"127.0.0.1",PORT:String(port),YHVH_GOSPEL_ENGINE_TOKEN:token,YHVH_GOSPEL_ENGINE_DATA_DIR:dir},
  stdio:["ignore","pipe","pipe"]
});
let stderr="";child.stderr.on("data",d=>stderr+=d);

async function waitHealth(){
  for(let i=0;i<30;i++){
    try{const r=await fetch("http://127.0.0.1:"+port+"/health");if(r.ok)return await r.json()}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error("engine did not start: "+stderr);
}
try{
  const health=await waitHealth();
  if(health.service!=="yhvh-gospel-engine"||health.authority!=="IZAKHONO")throw new Error("bad engine identity");

  const state=await (await fetch("http://127.0.0.1:"+port+"/v1/state")).json();
  if(state.mode!=="scheduled"||!state.programme?.current?.title)throw new Error("schedule state missing");
  if(!Array.isArray(state.adapters)||state.adapters.length<4)throw new Error("adapters missing");

  const denied=await fetch("http://127.0.0.1:"+port+"/v1/live",{method:"POST",headers:{"content-type":"application/json"},body:'{"active":true}'});
  if(denied.status!==401)throw new Error("unauthorized live control was not blocked");

  const live=await (await fetch("http://127.0.0.1:"+port+"/v1/live",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+token},body:JSON.stringify({active:true,label:"CI Revival Live",source:"studio-a"})})).json();
  if(live.mode!=="live-override")throw new Error("live override failed");

  const heartbeat=await (await fetch("http://127.0.0.1:"+port+"/v1/heartbeat",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+token},body:JSON.stringify({healthy:true,label:"ci-ingest"})})).json();
  if(heartbeat.ingest?.healthy!==true)throw new Error("ingest heartbeat failed");

  const state2=await (await fetch("http://127.0.0.1:"+port+"/v1/state")).json();
  if(state2.mode!=="live-override"||state2.ingest?.label!=="ci-ingest")throw new Error("engine state did not persist");

  const events=await readFile(join(dir,"events.ndjson"),"utf8");
  if(!events.includes("live-override-started")||!events.includes("ingest-heartbeat"))throw new Error("audit events missing");
  console.log("YHVH Gospel Engine test: PASS");
}finally{
  child.kill("SIGTERM");
  await new Promise(r=>child.once("close",r));
  await rm(dir,{recursive:true,force:true});
}

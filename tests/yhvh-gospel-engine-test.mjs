import { mkdtemp, rm, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const dir=await mkdtemp(join(tmpdir(),"yhvh-gospel-engine-"));
const port=await new Promise((resolve,reject)=>{
  const s=net.createServer();
  s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p))});
  s.on("error",reject);
});
const token="ci-owner-engine-token-1234567890";
const base="http://127.0.0.1:"+port;
const auth={"content-type":"application/json","authorization":"Bearer "+token};
const child=spawn(process.execPath,["engines/yhvh-gospel-engine/engine.mjs"],{
  cwd:process.cwd(),
  env:{...process.env,HOST:"127.0.0.1",PORT:String(port),YHVH_GOSPEL_ENGINE_TOKEN:token,YHVH_GOSPEL_ENGINE_DATA_DIR:dir},
  stdio:["ignore","pipe","pipe"]
});
let stderr="";child.stderr.on("data",d=>stderr+=d);

async function waitHealth(){
  for(let i=0;i<30;i++){
    try{const r=await fetch(base+"/health");if(r.ok)return await r.json()}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error("engine did not start: "+stderr);
}
try{
  const health=await waitHealth();
  if(health.service!=="yhvh-gospel-engine"||health.authority!=="IZAKHONO"||health.version!=="2.0.0")throw new Error("bad engine identity");
  if(health.independent_engine!==true||health.privacy?.behavioural_tracking!==false)throw new Error("independence/privacy contract missing");

  const capabilities=await (await fetch(base+"/v1/capabilities")).json();
  for(const capability of ["catalogue","scheduling","content-submissions","simulcast-state","health-verification","provider-adapters"]){
    if(!capabilities.owns?.includes(capability)) throw new Error("missing capability: "+capability);
  }

  const state=await (await fetch(base+"/v1/state")).json();
  if(state.mode!=="scheduled"||!state.programme?.current?.title)throw new Error("schedule state missing");
  if(!Array.isArray(state.adapters)||state.adapters.length<4)throw new Error("adapters missing");

  const denied=await fetch(base+"/v1/live",{method:"POST",headers:{"content-type":"application/json"},body:'{"active":true}'});
  if(denied.status!==401)throw new Error("unauthorized live control was not blocked");

  const cataloguePayload={
    revision:"ci-catalogue-1",
    items:[
      {id:"ci-001",title:"CI Gospel Special",type:"programme",language:"English",territory:"Global",duration_sec:1800,rights_status:"cleared"},
      {id:"ci-002",title:"CI Choir Hour",type:"music",language:"isiZulu",territory:"Africa",duration_sec:3600,rights_status:"review-required"}
    ]
  };
  const catalogueWrite=await (await fetch(base+"/v1/catalogue",{method:"PUT",headers:auth,body:JSON.stringify(cataloguePayload)})).json();
  if(catalogueWrite.catalogue?.items?.length!==2)throw new Error("catalogue write failed");
  const catalogue=await (await fetch(base+"/v1/catalogue")).json();
  if(catalogue.revision!=="ci-catalogue-1"||catalogue.items?.[0]?.title!=="CI Gospel Special")throw new Error("catalogue read failed");

  const submission=await (await fetch(base+"/v1/submissions",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({category:"content",type:"programme",name:"CI Producer",contact:"ci@example.invalid",message:"Submit programme",territory:"Global",language:"English",rightsAttested:true})
  })).json();
  if(!submission.ok||!String(submission.reference||"").startsWith("YHVH-"))throw new Error("submission intake failed");
  const submissions=await (await fetch(base+"/v1/submissions?limit=5",{headers:{authorization:"Bearer "+token}})).json();
  if(submissions.records?.[0]?.name!=="CI Producer")throw new Error("submission owner queue failed");

  const live=await (await fetch(base+"/v1/live",{method:"POST",headers:auth,body:JSON.stringify({active:true,label:"CI Revival Live",source:"studio-a"})})).json();
  if(live.mode!=="live-override")throw new Error("live override failed");

  const heartbeat=await (await fetch(base+"/v1/heartbeat",{method:"POST",headers:auth,body:JSON.stringify({healthy:true,label:"ci-ingest"})})).json();
  if(heartbeat.ingest?.healthy!==true)throw new Error("ingest heartbeat failed");

  const simulcast=await (await fetch(base+"/v1/simulcast/heartbeat",{method:"POST",headers:auth,body:JSON.stringify({healthy:true,label:"ci-simulcast",targets:["youtube","smart-tv"]})})).json();
  if(simulcast.simulcast?.healthy!==true||simulcast.simulcast?.targets?.length!==2)throw new Error("simulcast heartbeat failed");

  const scheduleWrite=await (await fetch(base+"/v1/schedule",{
    method:"PUT",headers:auth,
    body:JSON.stringify({timezone:"Africa/Johannesburg",revision:"ci-schedule-2",slots:[
      {start:"00:00",duration_min:720,title:"CI Morning Gospel",genre:"worship"},
      {start:"12:00",duration_min:720,title:"CI Evening Gospel",genre:"word"}
    ]})
  })).json();
  if(scheduleWrite.schedule?.revision!=="ci-schedule-2")throw new Error("schedule write failed");

  const state2=await (await fetch(base+"/v1/state")).json();
  if(state2.mode!=="live-override"||state2.ingest?.label!=="ci-ingest")throw new Error("engine state did not persist");
  if(state2.simulcast?.label!=="ci-simulcast"||state2.catalogue?.items!==2)throw new Error("engine operational state incomplete");

  const events=await readFile(join(dir,"events.ndjson"),"utf8");
  for(const expected of ["catalogue-updated","submission-received","live-override-started","ingest-heartbeat","simulcast-heartbeat","schedule-updated"]){
    if(!events.includes(expected))throw new Error("audit event missing: "+expected);
  }
  console.log("YHVH Gospel Engine v2 test: PASS");
}finally{
  child.kill("SIGTERM");
  await new Promise(r=>child.once("close",r));
  await rm(dir,{recursive:true,force:true});
}

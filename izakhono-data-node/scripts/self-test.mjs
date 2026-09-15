import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync,mkdirSync } from "node:fs";
import { resolve } from "node:path";

const port=19087;
const key=randomBytes(24).toString("hex");
const dir=resolve("./.self-test");
rmSync(dir,{recursive:true,force:true});
mkdirSync(dir,{recursive:true});

const child=spawn(process.execPath,["server.mjs"],{
  env:{...process.env,PORT:String(port),HOST:"127.0.0.1",IZAKHONO_DATA_KEY:key,IZAKHONO_DATA_DB:resolve(dir,"test.sqlite")},
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ok=false;
try{
  for(let i=0;i<30;i++){
    await sleep(150);
    try{
      const r=await fetch(`http://127.0.0.1:${port}/health`);
      if(r.ok){ok=true;break;}
    }catch{}
  }
  if(!ok) throw new Error("Health endpoint did not become ready");

  const event={
    eventId:"self-test-1",
    eventName:"lead",
    occurredAt:new Date().toISOString(),
    brand:"SELF TEST",
    source:"test"
  };

  const ingest=await fetch(`http://127.0.0.1:${port}/v1/events`,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":key},
    body:JSON.stringify(event)
  });
  if(!ingest.ok) throw new Error("Ingestion failed: "+await ingest.text());

  const duplicate=await fetch(`http://127.0.0.1:${port}/v1/events`,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":key},
    body:JSON.stringify(event)
  });
  const dup=await duplicate.json();
  if(dup.duplicates!==1) throw new Error("Idempotency test failed");

  const stats=await fetch(`http://127.0.0.1:${port}/v1/stats`,{headers:{"x-izakhono-key":key}});
  if(!stats.ok) throw new Error("Stats failed");

  console.log("IZAKHONO DATA NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(100);
  rmSync(dir,{recursive:true,force:true});
}

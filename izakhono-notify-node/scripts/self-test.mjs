import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const queuePort=19640;
const notifyPort=19642;
const adapterPort=19643;
const queueKey=randomBytes(24).toString("hex");
const notifyKey=randomBytes(24).toString("hex");
const enc=randomBytes(32).toString("base64");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

let adapterCalls=0;
const adapter=createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  adapterCalls++;
  if(adapterCalls===1){res.writeHead(500);return res.end("retry");}
  res.writeHead(202,{"content-type":"application/json"});
  res.end(JSON.stringify({accepted:true}));
});
await new Promise(resolve=>adapter.listen(adapterPort,"127.0.0.1",resolve));

const queue=spawn(process.execPath,["../izakhono-queue-node/server.mjs"],{
  env:{...process.env,HOST:"127.0.0.1",PORT:String(queuePort),IZAKHONO_QUEUE_KEY:queueKey,IZAKHONO_QUEUE_DB:resolve(root,"queue.sqlite")},
  stdio:["ignore","pipe","pipe"]
});
const notify=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,HOST:"127.0.0.1",PORT:String(notifyPort),
    IZAKHONO_NOTIFY_DB:resolve(root,"notify.sqlite"),
    IZAKHONO_NOTIFY_KEY:notifyKey,
    IZAKHONO_NOTIFY_ENCRYPTION_KEY:enc,
    IZAKHONO_QUEUE_URL:`http://127.0.0.1:${queuePort}`,
    IZAKHONO_QUEUE_KEY:queueKey,
    IZAKHONO_NOTIFY_POLL_MS:"60",
    IZAKHONO_NOTIFY_RETRY_BASE_SECONDS:"0",
    IZAKHONO_EMAIL_ADAPTER_URL:`http://127.0.0.1:${adapterPort}/email`,
    IZAKHONO_NOTIFY_WEBHOOK_ALLOWLIST:"127.0.0.1"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers={"x-izakhono-key":notifyKey,"content-type":"application/json"};

async function wait(url){
  for(let i=0;i<60;i++){await sleep(100);try{const r=await fetch(url);if(r.ok)return;}catch{}}
  throw new Error("Service not healthy: "+url);
}
async function post(path,body){
  const r=await fetch(`http://127.0.0.1:${notifyPort}${path}`,{method:"POST",headers,body:JSON.stringify(body)});
  return {r,body:await r.json()};
}
async function waitMessage(id,state){
  for(let i=0;i<80;i++){
    await sleep(100);
    const r=await fetch(`http://127.0.0.1:${notifyPort}/v1/messages/${id}`,{headers:{"x-izakhono-key":notifyKey}});
    const body=await r.json();
    if(body.message?.state===state)return body.message;
  }
  throw new Error("Message did not reach "+state);
}

try{
  await wait(`http://127.0.0.1:${queuePort}/health`);
  await wait(`http://127.0.0.1:${notifyPort}/health`);

  let x=await post("/v1/templates",{name:"welcome-email",channel:"email",subject:"Welcome {{first}}",body:"Hello {{first}}"});
  if(!x.r.ok) throw new Error("Email template failed");
  const emailTemplate=x.body.template.id;

  x=await post("/v1/recipients/user-1/channels",{channel:"email",address:"person@example.com"});
  if(!x.r.ok) throw new Error("Recipient email failed");

  x=await post("/v1/send",{recipientRef:"user-1",channel:"email",templateId:emailTemplate,variables:{first:"A"},idempotencyKey:"email-1",maxAttempts:3});
  if(!x.r.ok) throw new Error("Email send enqueue failed: "+JSON.stringify(x.body));
  const emailMessage=x.body.message.id;
  const delivered=await waitMessage(emailMessage,"delivered");
  if(delivered.attempts<2 || adapterCalls<2) throw new Error("Retry path was not exercised");

  x=await post("/v1/send",{recipientRef:"user-1",channel:"email",templateId:emailTemplate,variables:{first:"A"},idempotencyKey:"email-1"});
  if(!x.r.ok || x.body.idempotent!==true || x.body.message.id!==emailMessage) throw new Error("Idempotency failed");

  x=await post("/v1/templates",{name:"inbox-note",channel:"in_app",subject:"Action",body:"Review campaign {{campaign}}"});
  const inAppTemplate=x.body.template.id;
  x=await post("/v1/send",{recipientRef:"user-1",channel:"in_app",templateId:inAppTemplate,variables:{campaign:"Launch"}});
  if(!x.r.ok || !x.body.message) throw new Error("In-app enqueue failed: "+JSON.stringify(x.body));
  const inAppId=x.body.message.id;
  await waitMessage(inAppId,"delivered");

  let r=await fetch(`http://127.0.0.1:${notifyPort}/v1/inbox/user-1`,{headers:{"x-izakhono-key":notifyKey}});
  const inbox=await r.json();
  if(!r.ok || inbox.items.length!==1 || !inbox.items[0].body.includes("Launch")) throw new Error("In-app inbox failed");

  x=await post("/v1/recipients/user-1/preferences",{channel:"email",enabled:false});
  if(!x.r.ok) throw new Error("Preference update failed");
  x=await post("/v1/send",{recipientRef:"user-1",channel:"email",templateId:emailTemplate,variables:{first:"B"},idempotencyKey:"email-2"});
  if(!x.r.ok || x.body.message.state!=="suppressed") throw new Error("Preference suppression failed");

  console.log("IZAKHONO NOTIFY NODE SELF TEST: PASS");
}finally{
  notify.kill("SIGTERM");
  queue.kill("SIGTERM");
  adapter.close();
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}

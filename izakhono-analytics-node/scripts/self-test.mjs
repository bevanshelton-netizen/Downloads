import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const port=19630;
const admin=randomBytes(24).toString("hex");
const hashKey=randomBytes(32).toString("hex");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:String(port),
    IZAKHONO_ANALYTICS_DB:resolve(root,"analytics.sqlite"),
    IZAKHONO_ANALYTICS_ADMIN_KEY:admin,
    IZAKHONO_ANALYTICS_HASH_KEY:hashKey,
    IZAKHONO_ANALYTICS_COLLECT_LIMIT_PER_MIN:"100"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adminHeaders={"x-izakhono-key":admin,"content-type":"application/json"};

async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(120);
    try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("Analytics node did not become healthy");
}

async function collect(site,key,event,origin="https://example.com"){
  const r=await fetch(`http://127.0.0.1:${port}/v1/collect?site=${encodeURIComponent(site)}&key=${encodeURIComponent(key)}`,{
    method:"POST",
    headers:{"content-type":"text/plain","origin":origin},
    body:JSON.stringify(event)
  });
  return {r,body:await r.json()};
}

try{
  await waitHealth();

  let r=await fetch(`http://127.0.0.1:${port}/v1/sites`,{
    method:"POST",headers:adminHeaders,
    body:JSON.stringify({name:"Demo",allowedOrigins:["https://example.com"]})
  });
  if(!r.ok) throw new Error("Site create failed: "+await r.text());
  const created=await r.json();
  const site=created.site.id;
  const key=created.collectKey;

  r=await fetch(`http://127.0.0.1:${port}/tracker.js`);
  const js=await r.text();
  if(!r.ok || !js.includes("izakhonoAnalytics")) throw new Error("Tracker missing");

  const now=new Date().toISOString();
  let x=await collect(site,key,{
    eventName:"page_view",occurredAt:now,visitorId:"visitor-1",sessionId:"session-1",
    path:"/landing",title:"Landing",utmSource:"meta",utmMedium:"paid_social",utmCampaign:"world_launch",
    language:"en-ZA",properties:{variant:"a"}
  });
  if(!x.r.ok) throw new Error("Pageview collect failed");

  x=await collect(site,key,{
    eventName:"lead",occurredAt:new Date(Date.now()+10).toISOString(),visitorId:"visitor-1",sessionId:"session-1",
    path:"/landing",utmSource:"meta",utmCampaign:"world_launch",properties:{form:"hero"}
  });
  if(!x.r.ok) throw new Error("Lead collect failed");

  x=await collect(site,key,{
    eventName:"payment",occurredAt:new Date(Date.now()+20).toISOString(),visitorId:"visitor-1",sessionId:"session-1",
    path:"/checkout",value:500,currency:"ZAR",utmSource:"meta",utmCampaign:"world_launch"
  });
  if(!x.r.ok) throw new Error("Payment collect failed");

  x=await collect(site,key,{
    eventName:"page_view",occurredAt:now,visitorId:"visitor-x",sessionId:"session-x",path:"/bad"
  },"https://evil.example");
  if(x.r.status!==403) throw new Error("Origin gate failed");

  x=await collect(site,key,{
    eventName:"custom_event",occurredAt:now,visitorId:"visitor-1",sessionId:"session-1",
    properties:{email:"should-not-store@example.com"}
  });
  if(x.r.status!==400) throw new Error("PII property gate failed");

  r=await fetch(`http://127.0.0.1:${port}/v1/sites/${site}/overview`,{headers:{"x-izakhono-key":admin}});
  const overview=await r.json();
  if(!r.ok || overview.pageviews!==1 || overview.visitors!==1 || overview.sessions!==1 || overview.netRevenue!==500) throw new Error("Overview mismatch: "+JSON.stringify(overview));

  r=await fetch(`http://127.0.0.1:${port}/v1/sites/${site}/top?dimension=campaign`,{headers:{"x-izakhono-key":admin}});
  const top=await r.json();
  if(!r.ok || top.rows[0]?.value!=="world_launch") throw new Error("Top campaign mismatch");

  r=await fetch(`http://127.0.0.1:${port}/v1/sites/${site}/funnel?steps=page_view,lead,payment`,{headers:{"x-izakhono-key":admin}});
  const funnel=await r.json();
  if(!r.ok || funnel.steps[2]?.sessions!==1) throw new Error("Funnel mismatch: "+JSON.stringify(funnel));

  console.log("IZAKHONO ANALYTICS NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}

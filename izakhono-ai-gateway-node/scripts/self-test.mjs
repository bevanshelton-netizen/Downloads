import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const providerPort=19650;
const gatewayPort=19651;
const admin=randomBytes(24).toString("hex");
const enc=randomBytes(32).toString("base64");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

let providerCalls=0;
const provider=createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  providerCalls++;
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  res.writeHead(200,{"content-type":"application/json"});
  res.end(JSON.stringify({
    id:"local-response-"+providerCalls,
    object:"chat.completion",
    model:body.model,
    choices:[{index:0,message:{role:"assistant",content:"local:"+body.messages.at(-1).content},finish_reason:"stop"}],
    usage:{prompt_tokens:12,completion_tokens:7,total_tokens:19}
  }));
});
await new Promise(resolve=>provider.listen(providerPort,"127.0.0.1",resolve));

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",PORT:String(gatewayPort),
    IZAKHONO_AI_GATEWAY_DB:resolve(root,"gateway.sqlite"),
    IZAKHONO_AI_GATEWAY_ADMIN_KEY:admin,
    IZAKHONO_AI_GATEWAY_ENCRYPTION_KEY:enc,
    IZAKHONO_AI_PROVIDER_ALLOWLIST:"127.0.0.1,localhost",
    IZAKHONO_AI_CIRCUIT_FAILURES:"1",
    IZAKHONO_AI_CIRCUIT_SECONDS:"30"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adminHeaders={"x-izakhono-key":admin,"content-type":"application/json"};

async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(100);
    try{const r=await fetch(`http://127.0.0.1:${gatewayPort}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("AI gateway did not become healthy");
}
async function adminPost(path,body){
  const r=await fetch(`http://127.0.0.1:${gatewayPort}${path}`,{method:"POST",headers:adminHeaders,body:JSON.stringify(body)});
  const payload=await r.json();
  if(!r.ok) throw new Error(path+" failed: "+JSON.stringify(payload));
  return payload;
}

try{
  await waitHealth();

  const bad=await adminPost("/v1/admin/providers",{
    name:"broken-local",baseUrl:"http://127.0.0.1:19659",isLocal:true,priority:1,timeoutMs:500
  });
  const good=await adminPost("/v1/admin/providers",{
    name:"owned-local",baseUrl:`http://127.0.0.1:${providerPort}`,isLocal:true,priority:2,apiKey:"local-secret"
  });

  await adminPost("/v1/admin/routes",{alias:"nexai-default",providerId:bad.provider.id,upstreamModel:"bad-model",rank:1});
  await adminPost("/v1/admin/routes",{alias:"nexai-default",providerId:good.provider.id,upstreamModel:"local-model",rank:2});

  const client=await adminPost("/v1/admin/clients",{
    name:"growth-os",allowedAliases:["nexai-default"],dailyRequests:2,dailyTokens:1000
  });

  let r=await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer "+client.apiKey},
    body:JSON.stringify({model:"nexai-default",messages:[{role:"user",content:"hello"}]})
  });
  let body=await r.json();
  if(!r.ok || body.choices?.[0]?.message?.content!=="local:hello") throw new Error("Chat/failover failed: "+JSON.stringify(body));
  if(body.model!=="nexai-default" || body.x_izakhono?.provider!=="owned-local") throw new Error("Gateway metadata mismatch");

  r=await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer "+client.apiKey},
    body:JSON.stringify({model:"nexai-default",messages:[{role:"user",content:"second"}]})
  });
  if(!r.ok) throw new Error("Second chat failed");

  r=await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer "+client.apiKey},
    body:JSON.stringify({model:"nexai-default",messages:[{role:"user",content:"quota"}]})
  });
  body=await r.json();
  if(r.status!==429 || body.error?.type!=="quota_error") throw new Error("Request quota failed");

  r=await fetch(`http://127.0.0.1:${gatewayPort}/v1/admin/providers`,{headers:{"x-izakhono-key":admin}});
  body=await r.json();
  if(JSON.stringify(body).includes("local-secret")) throw new Error("Provider secret leaked");

  r=await fetch(`http://127.0.0.1:${gatewayPort}/v1/admin/usage`,{headers:{"x-izakhono-key":admin}});
  body=await r.json();
  if(!r.ok || body.usage[0]?.requests!==2 || body.usage[0]?.input_tokens!==24) throw new Error("Usage accounting failed: "+JSON.stringify(body));

  r=await fetch(`http://127.0.0.1:${gatewayPort}/v1/admin/requests`,{headers:{"x-izakhono-key":admin}});
  body=await r.json();
  if(!r.ok || body.requests.length<3) throw new Error("Request ledger missing");
  const raw=JSON.stringify(body);
  if(raw.includes("hello") || raw.includes("second")) throw new Error("Prompt content leaked into ledger");

  console.log("IZAKHONO AI GATEWAY NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  provider.close();
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}

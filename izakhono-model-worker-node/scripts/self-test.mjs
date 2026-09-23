import { createServer } from "node:http";
import { spawn } from "node:child_process";

const computePort=19880,enginePort=19881,workerPort=19882,key="worker-test";
let registered=false,heartbeats=0;
async function read(req){let s="";for await(const c of req)s+=c;return s?JSON.parse(s):{}}
function json(res,status,b){res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(b))}

const compute=createServer(async(req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(req.headers["x-izakhono-worker-key"]!==key)return json(res,401,{error:"bad key"});
  if(req.method==="POST"&&u.pathname==="/v1/workers/register"){
    const b=await read(req);registered=b.name==="test-worker"&&b.models?.[0]?.alias==="izakhono-small";
    return json(res,200,{worker:{id:"worker-1"}});
  }
  if(req.method==="POST"&&u.pathname==="/v1/workers/worker-1/heartbeat"){heartbeats++;return json(res,200,{worker:{id:"worker-1"}})}
  return json(res,404,{error:"not found"});
}).listen(computePort,"127.0.0.1");

const engine=createServer(async(req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(req.method==="GET"&&u.pathname==="/v1/models")return json(res,200,{data:[{id:"local-qwen"}]});
  if(req.method==="POST"&&u.pathname==="/v1/chat/completions"){
    const b=await read(req);
    return json(res,200,{id:"e1",object:"chat.completion",model:b.model,choices:[{index:0,message:{role:"assistant",content:"worker ok"},finish_reason:"stop"}],usage:{prompt_tokens:2,completion_tokens:2,total_tokens:4}});
  }
  return json(res,404,{error:"not found"});
}).listen(enginePort,"127.0.0.1");

const child=spawn(process.execPath,["server.mjs"],{cwd:new URL("..",import.meta.url).pathname,env:{...process.env,HOST:"127.0.0.1",PORT:String(workerPort),IZAKHONO_MODEL_WORKER_NAME:"test-worker",IZAKHONO_GPU_WORKER_KEY:key,IZAKHONO_GPU_COMPUTE_URL:`http://127.0.0.1:${computePort}`,IZAKHONO_MODEL_ENGINE_URL:`http://127.0.0.1:${enginePort}`,IZAKHONO_MODEL_ENGINE_ALLOWLIST:"127.0.0.1",IZAKHONO_MODEL_WORKER_MODELS:'[{"alias":"izakhono-small","upstreamModel":"local-qwen"}]',IZAKHONO_MODEL_WORKER_ALLOW_CPU:"true",IZAKHONO_MODEL_WORKER_HEARTBEAT_MS:"5000"},stdio:["ignore","pipe","pipe"]});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${workerPort}/health`);if(r.ok)break}catch{}await sleep(100)}
try{
  await sleep(100);
  let r=await fetch(`http://127.0.0.1:${workerPort}/health`);let h=await r.json();
  if(!r.ok||h.ready!==true||h.engineReachable!==true||!registered)throw new Error("worker readiness/registration failed "+JSON.stringify(h));
  r=await fetch(`http://127.0.0.1:${workerPort}/v1/chat/completions`,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},body:JSON.stringify({model:"local-qwen",messages:[{role:"user",content:"hi"}]})});
  const j=await r.json();if(!r.ok||j.choices?.[0]?.message?.content!=="worker ok")throw new Error("proxy failed");
  r=await fetch(`http://127.0.0.1:${workerPort}/v1/chat/completions`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(r.status!==401)throw new Error("worker auth failed closed");
  console.log("IZAKHONO MODEL WORKER self-test passed.");
}finally{child.kill("SIGTERM");compute.close();engine.close();await sleep(100)}

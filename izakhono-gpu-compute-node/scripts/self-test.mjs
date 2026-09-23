import { spawn } from "node:child_process";
import { createServer } from "node:http";

const serviceKey="svc-test",workerKey="worker-test";
const worker=await new Promise(resolve=>{
  const s=createServer((req,res)=>{
    if(req.method==="POST"&&req.url==="/v1/chat/completions"){
      let b="";req.on("data",c=>b+=c);req.on("end",()=>{const j=JSON.parse(b);const p={id:"local-test",object:"chat.completion",model:j.model,choices:[{index:0,message:{role:"assistant",content:"owned gpu ok"},finish_reason:"stop"}],usage:{prompt_tokens:4,completion_tokens:3,total_tokens:7}};res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(p))});return;
    }
    res.writeHead(404);res.end();
  }).listen(18966,"127.0.0.1",()=>resolve(s));
});
const child=spawn(process.execPath,["server.mjs"],{cwd:new URL("..",import.meta.url).pathname,env:{...process.env,HOST:"127.0.0.1",PORT:"18965",IZAKHONO_GPU_COMPUTE_DB:"./data/self-test.sqlite",IZAKHONO_GPU_COMPUTE_KEY:serviceKey,IZAKHONO_GPU_WORKER_KEY:workerKey,IZAKHONO_GPU_WORKER_ALLOWLIST:"127.0.0.1"}});
await new Promise(r=>setTimeout(r,700));
const reg=await fetch("http://127.0.0.1:18965/v1/workers/register",{method:"POST",headers:{"content-type":"application/json","x-izakhono-worker-key":workerKey},body:JSON.stringify({name:"gpu-test-01",endpoint:"http://127.0.0.1:18966",models:[{alias:"izakhono-small",upstreamModel:"local-model"}],gpus:[{vendor:"test",model:"virtual",vramMb:24576,freeVramMb:22000,utilizationPct:5}]})});
if(!reg.ok)throw new Error("register failed "+await reg.text());
const cap=await fetch("http://127.0.0.1:18965/v1/capacity",{headers:{authorization:"Bearer "+serviceKey}});
const capj=await cap.json();if(!cap.ok||capj.totals.totalVramMb!==24576)throw new Error("capacity failed");
const chat=await fetch("http://127.0.0.1:18965/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+serviceKey},body:JSON.stringify({model:"izakhono-small",messages:[{role:"user",content:"hello"}]})});
const cj=await chat.json();if(!chat.ok||cj.choices?.[0]?.message?.content!=="owned gpu ok"||cj.izakhono_gpu?.owned_compute!==true)throw new Error("chat failed");
child.kill("SIGTERM");worker.close();
console.log("IZAKHONO GPU COMPUTE NODE self-test passed.");

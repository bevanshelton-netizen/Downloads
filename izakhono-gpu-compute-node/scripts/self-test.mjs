import { spawn } from "node:child_process";
import { createServer } from "node:http";

const serviceKey="svc-test",workerKey="worker-test";
const worker=await new Promise(resolve=>{
  const s=createServer((req,res)=>{
    if(req.method==="POST"&&req.url==="/v1/chat/completions"){
      let b="";
      req.on("data",c=>b+=c);
      req.on("end",()=>{
        const j=JSON.parse(b);
        const p={id:"local-test",object:"chat.completion",model:j.model,choices:[{index:0,message:{role:"assistant",content:"owned gpu ok"},finish_reason:"stop"}],usage:{prompt_tokens:4,completion_tokens:3,total_tokens:7}};
        res.writeHead(200,{"content-type":"application/json"});
        res.end(JSON.stringify(p));
      });
      return;
    }
    res.writeHead(404);res.end();
  }).listen(18966,"127.0.0.1",()=>resolve(s));
});

const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL("..",import.meta.url).pathname,
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:"18965",
    IZAKHONO_GPU_COMPUTE_DB:"./data/self-test.sqlite",
    IZAKHONO_GPU_COMPUTE_KEY:serviceKey,
    IZAKHONO_GPU_WORKER_KEY:workerKey,
    IZAKHONO_GPU_WORKER_ALLOWLIST:"127.0.0.1"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitHealth(){
  let lastError="";
  for(let i=0;i<40;i++){
    if(child.exitCode!==null) throw new Error("GPU compute server exited before health became ready");
    try{
      const r=await fetch("http://127.0.0.1:18965/health",{signal:AbortSignal.timeout(500)});
      if(r.ok){
        const body=await r.json();
        if(body.status==="healthy") return;
        lastError="health status="+String(body.status);
      }
    }catch(error){
      lastError=String(error?.message||error);
    }
    await sleep(100);
  }
  throw new Error("GPU compute server did not become ready: "+lastError);
}

try{
  await waitHealth();

  const reg=await fetch("http://127.0.0.1:18965/v1/workers/register",{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-worker-key":workerKey},
    body:JSON.stringify({
      name:"gpu-test-01",
      endpoint:"http://127.0.0.1:18966",
      models:[{alias:"izakhono-small",upstreamModel:"local-model"}],
      gpus:[{vendor:"test",model:"virtual",vramMb:24576,freeVramMb:22000,utilizationPct:5}]
    })
  });
  if(!reg.ok)throw new Error("register failed "+await reg.text());

  const cap=await fetch("http://127.0.0.1:18965/v1/capacity",{headers:{authorization:"Bearer "+serviceKey}});
  const capj=await cap.json();
  if(!cap.ok||capj.totals.totalVramMb!==24576)throw new Error("capacity failed");

  const chat=await fetch("http://127.0.0.1:18965/v1/chat/completions",{
    method:"POST",
    headers:{"content-type":"application/json",authorization:"Bearer "+serviceKey},
    body:JSON.stringify({model:"izakhono-small",messages:[{role:"user",content:"hello"}]})
  });
  const cj=await chat.json();
  if(!chat.ok||cj.choices?.[0]?.message?.content!=="owned gpu ok"||cj.izakhono_gpu?.owned_compute!==true)throw new Error("chat failed");

  console.log("IZAKHONO GPU COMPUTE NODE self-test passed.");
}finally{
  child.kill("SIGTERM");
  await new Promise(resolve=>worker.close(resolve));
}

import { spawn } from "node:child_process";

const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL("..",import.meta.url).pathname,
  env:{...process.env,HOST:"127.0.0.1",PORT:"18970",IZAKHONO_ONE_AI_KEY:"test-service-key",IZAKHONO_ONE_AI_GATEWAY_KEY:"test-gateway-key"}
});

const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<30;i++){
  try{
    const r=await fetch("http://127.0.0.1:18970/health");
    if(r.ok)break;
  }catch{}
  await wait(100);
}

const health=await fetch("http://127.0.0.1:18970/health");
const hj=await health.json();
if(!health.ok||hj.product!=="IZAKHONO ONE AI"||hj.status!=="healthy")throw new Error("health failed");

const home=await fetch("http://127.0.0.1:18970/");
const html=await home.text();
if(!home.ok||!home.headers.get("content-type")?.includes("text/html")||!html.includes("IZAKHONO ONE"))throw new Error("launchpad failed");

const products=await fetch("http://127.0.0.1:18970/v1/public-products");
const pj=await products.json();
if(!products.ok||!Array.isArray(pj.products)||!pj.products.some(p=>p.id==="izakhono-one-ai"))throw new Error("public products failed");
if(pj.products.some(p=>p.public_status==="target-defined"&&p.public_url))throw new Error("target-defined product exposed as usable");
if(!pj.products.some(p=>p.public_status==="temporary-public"&&p.public_url))throw new Error("temporary public route missing");

const protectedCall=await fetch("http://127.0.0.1:18970/v1/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({request:"test"})});
if(protectedCall.status!==401)throw new Error("protected endpoint did not fail closed");

child.kill("SIGTERM");
console.log("IZAKHONO ONE AI public launchpad self-test passed.");

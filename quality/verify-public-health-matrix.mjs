import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";

const root=resolve(process.cwd());
const matrix=JSON.parse(await readFile(resolve(root,"quality/public-health-matrix.json"),"utf8"));
const rollout=JSON.parse(await readFile(resolve(root,"izakhono-one-ai/public-sellable-rollout.json"),"utf8"));
const products=new Map((rollout.products||[]).map(p=>[p.id,p]));
const network=process.argv.includes("--network");
const report={
  schema:"izakhono.public-health-report/v1",
  generatedAt:new Date().toISOString(),
  network,
  results:[]
};
let failed=false;

for(const probe of matrix.probes||[]){
  const product=products.get(probe.product);
  const row={id:probe.id,product:probe.product,url:probe.url,mode:probe.mode,status:"contract-ok"};
  if(!product){row.status="contract-fail";row.error="product missing from rollout";failed=true;report.results.push(row);continue}
  if(!String(probe.url).startsWith("https://")){row.status="contract-fail";row.error="HTTPS required";failed=true;report.results.push(row);continue}
  if(probe.mode==="required-resilience"){
    if(product.public_status!=="temporary-public"||product.fallback!==probe.url){
      row.status="contract-fail";row.error="resilience probe no longer matches temporary-public fallback";failed=true;
    }
  }else if(probe.mode==="observe"){
    if(product.owned_target&&product.owned_target!==probe.url){
      row.status="contract-fail";row.error="owned target drift";failed=true;
    }
  }else if(probe.mode==="required"){
    if(product.public_status!=="owned-public-verified"||product.owned_target!==probe.url){
      row.status="contract-fail";row.error="required owned probe without owned-public-verified state";failed=true;
    }
  }
  if(network&&row.status==="contract-ok"){
    const started=Date.now();
    try{
      const response=await fetch(probe.url,{
        method:"GET",
        redirect:"follow",
        headers:{"user-agent":"IZAKHONO-Public-Health/1.0","accept":"text/html,application/json;q=0.9,*/*;q=0.5"},
        signal:AbortSignal.timeout(10000)
      });
      row.httpStatus=response.status;
      row.finalUrl=response.url;
      row.latencyMs=Date.now()-started;
      row.status=response.status>=200&&response.status<400?"reachable":"http-fail";
      await response.body?.cancel().catch(()=>{});
      if(row.status!=="reachable"&&["required","required-resilience"].includes(probe.mode)) failed=true;
    }catch(error){
      row.latencyMs=Date.now()-started;
      row.status="network-fail";
      row.error=error instanceof Error?error.message:String(error);
      if(["required","required-resilience"].includes(probe.mode)) failed=true;
    }
  }
  report.results.push(row);
}

await writeFile(resolve(root,"quality/public-health-report.json"),JSON.stringify(report,null,2)+"\n");
for(const r of report.results) console.log(`${r.mode}\t${r.status}\t${r.product}\t${r.url}${r.httpStatus?"\tHTTP "+r.httpStatus:""}`);
if(failed){
  console.error("PUBLIC_HEALTH_MATRIX=FAIL");
  process.exit(2);
}
console.log("PUBLIC_HEALTH_MATRIX=PASS probes="+report.results.length+" network="+network);

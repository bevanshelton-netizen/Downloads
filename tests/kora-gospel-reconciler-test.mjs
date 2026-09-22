import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root=await mkdtemp(join(tmpdir(),"kora-gospel-reconcile-"));
let state="buffered";
let patches=0;
const sample={
  id:"11111111-1111-4111-8111-111111111111",
  created_at:"2026-09-22T08:00:00Z",
  reference:"KGE-20260922-ABC12345",
  category:"partner",
  type:"sponsor",
  name:"Global Gospel Partner",
  contact:"partner@example.invalid",
  message:"Interested in programme sponsorship.",
  on_air:false,
  source_channel:"external-resilience-web",
  source_origin:"https://kora-network.vercel.app",
  territory:"Global",
  language:"English",
  rights_attested:false,
  details:{package:"programme-sponsor",budget:"quote-request"},
  status:"buffered"
};

const server=createServer(async(req,res)=>{
  if(req.url?.startsWith("/rest/v1/kora_gospel_external_intake") && req.method==="GET"){
    res.setHeader("content-type","application/json");
    res.end(JSON.stringify(state==="buffered"?[sample]:[])); return;
  }
  if(req.url?.startsWith("/rest/v1/kora_gospel_external_intake") && req.method==="PATCH"){
    patches++; state="imported"; res.statusCode=204; res.end(); return;
  }
  res.statusCode=404; res.end();
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const port=server.address().port;

async function run(resetExternal=false){
  if(resetExternal) state="buffered";
  return await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,["izakhono-owned-cloud/reconcile-kora-gospel-intake.mjs"],{
      cwd:process.cwd(),
      env:{
        ...process.env,
        SUPABASE_URL:"http://127.0.0.1:"+port,
        SUPABASE_SECRET_KEY:"sb_secret_ci_test_only",
        GOSPEL_TV_DATA_DIR:join(root,"data"),
        GOSPEL_RECONCILE_RECEIPT:join(root,"receipt.json"),
        GOSPEL_RECONCILE_LOCK:join(root,"lock"),
        GOSPEL_RECONCILE_WORKER:"ci-reconciler"
      },
      stdio:["ignore","pipe","pipe"]
    });
    let out="",err="";
    child.stdout.on("data",d=>out+=d); child.stderr.on("data",d=>err+=d);
    child.on("error",reject);
    child.on("close",code=>code===0?resolve(out):reject(new Error("reconciler exit "+code+"\n"+out+"\n"+err)));
  });
}

try{
  const first=await run();
  if(!first.includes("IMPORTED=1")) throw new Error("first run did not import");
  const raw1=await readFile(join(root,"data","submissions.ndjson"),"utf8");
  if(raw1.trim().split("\n").length!==1) throw new Error("expected one owned row after first import");
  const row=JSON.parse(raw1.trim());
  if(row.external_reference!==sample.reference || row.authoritative!==true || row.source_channel!=="external-reconciled") throw new Error("owned record boundary incorrect");
  if(patches!==1) throw new Error("external row was not marked imported");

  const second=await run(true);
  if(!second.includes("DUPLICATES=1")) throw new Error("retry did not identify duplicate");
  const raw2=await readFile(join(root,"data","submissions.ndjson"),"utf8");
  if(raw2.trim().split("\n").length!==1) throw new Error("retry duplicated owned row");
  if(patches!==2) throw new Error("duplicate retry did not repair external status");

  const receipt=JSON.parse(await readFile(join(root,"receipt.json"),"utf8"));
  if(receipt.authority!=="IZAKHONO" || receipt.source_authoritative!==false) throw new Error("receipt authority boundary incorrect");
  console.log("KORA Gospel reconciliation test: PASS");
}finally{
  await new Promise(resolve=>server.close(resolve));
  await rm(root,{recursive:true,force:true});
}

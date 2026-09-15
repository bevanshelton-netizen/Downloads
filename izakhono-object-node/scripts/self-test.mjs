import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const port=19400;
const key=randomBytes(24).toString("hex");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:String(port),
    IZAKHONO_OBJECT_KEY:key,
    IZAKHONO_OBJECT_ROOT:resolve(root,"objects"),
    IZAKHONO_OBJECT_DB:resolve(root,"object.sqlite"),
    IZAKHONO_OBJECT_TMP:resolve(root,"tmp"),
    IZAKHONO_OBJECT_BUCKET_QUOTA_BYTES:"1024"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers={"x-izakhono-key":key};

async function waitHealth(){
  for(let i=0;i<30;i++){
    await sleep(120);
    try{
      const r=await fetch(`http://127.0.0.1:${port}/health`);
      if(r.ok) return;
    }catch{}
  }
  throw new Error("Object node did not become healthy");
}

try{
  await waitHealth();

  let r=await fetch(`http://127.0.0.1:${port}/v1/buckets`,{
    method:"POST",
    headers:{...headers,"content-type":"application/json"},
    body:JSON.stringify({name:"creative",quotaBytes:1024})
  });
  if(!r.ok) throw new Error("Bucket create failed");

  const data="hello-owned-storage";
  r=await fetch(`http://127.0.0.1:${port}/v1/object/creative/demo.txt`,{
    method:"PUT",
    headers:{...headers,"content-type":"text/plain"},
    body:data
  });
  if(!r.ok) throw new Error("Object put failed: "+await r.text());
  const first=await r.json();

  r=await fetch(`http://127.0.0.1:${port}/v1/object/creative/copy.txt`,{
    method:"PUT",
    headers:{...headers,"content-type":"text/plain"},
    body:data
  });
  const second=await r.json();
  if(first.sha256!==second.sha256) throw new Error("Content addressing failed");

  r=await fetch(`http://127.0.0.1:${port}/v1/object/creative/demo.txt`,{headers});
  if(!r.ok || await r.text()!==data) throw new Error("Object get failed");

  r=await fetch(`http://127.0.0.1:${port}/v1/buckets/creative/objects?prefix=demo`,{headers});
  const listing=await r.json();
  if(listing.objects.length!==1) throw new Error("Object list failed");

  r=await fetch(`http://127.0.0.1:${port}/v1/object/creative/demo.txt`,{method:"DELETE",headers});
  if(!r.ok) throw new Error("Delete failed");

  console.log("IZAKHONO OBJECT NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(100);
  rmSync(root,{recursive:true,force:true});
}

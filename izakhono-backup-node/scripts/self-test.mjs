
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

const root=resolve("./.self-test");
const source=resolve(root,"source");
const forbidden=resolve(root,"forbidden");
const archives=resolve(root,"archives");
const restores=resolve(root,"restores");
const mirror=resolve(root,"mirrors/disk2");
const port=19670;
const admin=randomBytes(24).toString("hex");
const enc=randomBytes(32).toString("base64");

rmSync(root,{recursive:true,force:true});
mkdirSync(source,{recursive:true});
mkdirSync(forbidden,{recursive:true});
mkdirSync(mirror,{recursive:true});
writeFileSync(resolve(source,"important.txt"),"version-one\n");

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:String(port),
    IZAKHONO_BACKUP_DB:resolve(root,"backup.sqlite"),
    IZAKHONO_BACKUP_ARCHIVE_ROOT:archives,
    IZAKHONO_BACKUP_RESTORE_ROOT:restores,
    IZAKHONO_BACKUP_ADMIN_KEY:admin,
    IZAKHONO_BACKUP_ENCRYPTION_KEY:enc,
    IZAKHONO_BACKUP_SOURCE_ALLOWLIST:source,
    IZAKHONO_BACKUP_MIRROR_ROOTS:mirror,
    IZAKHONO_BACKUP_INTERVAL_HOURS:"0"
  },
  stdio:["ignore","pipe","pipe"]
});

let childErr="";
child.stderr.on("data",c=>childErr+=c.toString("utf8"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers={"x-izakhono-key":admin,"content-type":"application/json"};

async function waitHealth(){
  for(let i=0;i<50;i++){
    await sleep(100);
    try{
      const r=await fetch("http://127.0.0.1:"+port+"/health");
      if(r.ok) return;
    }catch{}
  }
  throw new Error("Backup node did not become healthy: "+childErr);
}
async function post(path,body={}){
  const r=await fetch("http://127.0.0.1:"+port+path,{
    method:"POST",headers,body:JSON.stringify(body)
  });
  const payload=await r.json();
  return {r,payload};
}
async function get(path){
  const r=await fetch("http://127.0.0.1:"+port+path,{headers:{"x-izakhono-key":admin}});
  const payload=await r.json();
  return {r,payload};
}

try{
  await waitHealth();

  let r=await fetch("http://127.0.0.1:"+port+"/v1/sets");
  if(r.status!==401) throw new Error("Admin API allowed anonymous access");

  let x=await post("/v1/sets",{name:"stack",sources:[source],retentionCount:1});
  if(!x.r.ok) throw new Error("Set create failed: "+JSON.stringify(x.payload));
  const setId=x.payload.set.id;

  x=await post("/v1/sets/"+setId+"/snapshots");
  if(!x.r.ok || x.payload.snapshot.state!=="complete") throw new Error("First snapshot failed: "+JSON.stringify(x.payload));
  const first=x.payload.snapshot;
  if(!existsSync(first.archive_path)) throw new Error("First archive missing");
  const firstMirror=resolve(mirror,"stack",basename(first.archive_path));
  if(!existsSync(firstMirror) || !existsSync(firstMirror+".sha256")) throw new Error("Mirror copy missing");

  x=await post("/v1/snapshots/"+first.id+"/verify");
  if(!x.r.ok || x.payload.verified!==true) throw new Error("First verify failed: "+JSON.stringify(x.payload));

  writeFileSync(resolve(source,"important.txt"),"version-two\n");
  writeFileSync(resolve(source,"second.txt"),"more-data\n");

  x=await post("/v1/sets/"+setId+"/snapshots");
  if(!x.r.ok || x.payload.snapshot.state!=="complete") throw new Error("Second snapshot failed: "+JSON.stringify(x.payload));
  const second=x.payload.snapshot;

  const list=await get("/v1/sets/"+setId+"/snapshots");
  if(!list.r.ok) throw new Error("Snapshot list failed");
  const old=list.payload.snapshots.find(s=>s.id===first.id);
  const latest=list.payload.snapshots.find(s=>s.id===second.id);
  if(old?.state!=="pruned" || existsSync(first.archive_path)) throw new Error("Retention pruning failed");
  if(latest?.state!=="complete") throw new Error("Latest snapshot not complete");

  x=await post("/v1/snapshots/"+second.id+"/verify");
  if(!x.r.ok || x.payload.verified!==true) throw new Error("Second verify failed: "+JSON.stringify(x.payload));

  x=await post("/v1/snapshots/"+second.id+"/restore",{destinationName:"recovery-test"});
  if(!x.r.ok || x.payload.restored!==true) throw new Error("Restore failed: "+JSON.stringify(x.payload));
  const restoredRoot=x.payload.destination;
  const restoredSource=resolve(restoredRoot,relative("/",source));
  if(readFileSync(resolve(restoredSource,"important.txt"),"utf8")!=="version-two\n") throw new Error("Restored primary file mismatch");
  if(readFileSync(resolve(restoredSource,"second.txt"),"utf8")!=="more-data\n") throw new Error("Restored secondary file mismatch");

  x=await post("/v1/sets",{name:"forbidden",sources:[forbidden],retentionCount:1});
  if(x.r.status!==400 || x.payload.error!=="SOURCE_NOT_ALLOWED") throw new Error("Source allowlist failed");

  const health=await fetch("http://127.0.0.1:"+port+"/health").then(r=>r.json());
  if(health.encryption!=="AES-256-GCM" || health.mirrorsConfigured!==1) throw new Error("Health metadata mismatch");

  console.log("IZAKHONO BACKUP NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}

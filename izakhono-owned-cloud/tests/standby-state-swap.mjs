import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root=mkdtempSync(join(tmpdir(),"izakhono-promotion-"));
const staged=join(root,"stage");
const liveRoot=join(root,"live");
const promotion=join(liveRoot,"var/lib/izakhono-standby/promotions");

const data=[
  "izakhono-data","izakhono-object","izakhono-queue","izakhono-auth",
  "izakhono-analytics","izakhono-notify","izakhono-ai-gateway","izakhono-code"
];
const envs=[
  "data-node.env","object-node.env","queue-node.env","auth-node.env",
  "analytics-node.env","notify-node.env","ai-gateway-node.env","code-node.env"
];

function put(path,value){
  mkdirSync(join(path,".."),{recursive:true});
  writeFileSync(path,value);
}
for(const name of data){
  put(join(staged,"var/lib",name,"value.txt"),"new-"+name);
  put(join(liveRoot,"var/lib",name,"value.txt"),"old-"+name);
}
for(const name of envs){
  put(join(staged,"etc/izakhono",name),"SECRET=new-"+name+"\n");
  put(join(liveRoot,"etc/izakhono",name),"SECRET=old-"+name+"\n");
}

const helper=new URL("../standby-state-swap.mjs",import.meta.url).pathname;
function run(args){
  const r=spawnSync(process.execPath,[helper,...args],{
    env:{...process.env,IZAKHONO_PROMOTION_TEST:"1"},
    encoding:"utf8"
  });
  if(r.status!==0) throw new Error(r.stderr||r.stdout);
  return JSON.parse(r.stdout);
}

try{
  const applied=run(["apply","--staged-root",staged,"--promotion-root",promotion,"--root-prefix",liveRoot]);
  if(applied.status!=="APPLIED") throw new Error("Apply status mismatch");

  for(const name of data){
    const v=readFileSync(join(liveRoot,"var/lib",name,"value.txt"),"utf8");
    if(v!=="new-"+name) throw new Error("State not promoted: "+name);
  }
  for(const name of envs){
    const v=readFileSync(join(liveRoot,"etc/izakhono",name),"utf8");
    if(v!=="SECRET=new-"+name+"\n") throw new Error("Env not promoted: "+name);
  }

  const rolled=run(["rollback","--manifest",applied.manifest,"--promotion-root",promotion,"--root-prefix",liveRoot]);
  if(rolled.status!=="ROLLED_BACK") throw new Error("Rollback status mismatch");

  for(const name of data){
    const v=readFileSync(join(liveRoot,"var/lib",name,"value.txt"),"utf8");
    if(v!=="old-"+name) throw new Error("State not rolled back: "+name);
  }
  for(const name of envs){
    const v=readFileSync(join(liveRoot,"etc/izakhono",name),"utf8");
    if(v!=="SECRET=old-"+name+"\n") throw new Error("Env not rolled back: "+name);
  }

  console.log("IZAKHONO STANDBY STATE SWAP SELF TEST: PASS");
}finally{
  rmSync(root,{recursive:true,force:true});
}

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const args=process.argv.slice(2);
function arg(name){
  const i=args.indexOf(name);
  return i>=0?args[i+1]:null;
}
function fail(message,code=2){
  console.error(message);
  process.exit(code);
}
function inside(root,path){
  const r=resolve(root),p=resolve(path);
  return p===r || p.startsWith(r.endsWith(sep)?r:r+sep);
}
function command(exe,argv){
  const r=spawnSync(exe,argv,{stdio:"pipe",encoding:"utf8"});
  if(r.status!==0) throw new Error((r.stderr||r.stdout||exe+" failed").trim());
}
function copyArchive(src,dst){
  mkdirSync(dirname(dst),{recursive:true});
  command("cp",["-a",src,dst]);
}
function safeRemove(path,root){
  if(!inside(root,path)) throw new Error("Refusing removal outside promotion root: "+path);
  rmSync(path,{recursive:true,force:true});
}

const action=args[0];
const stagedRoot=arg("--staged-root");
const promotionRoot=resolve(arg("--promotion-root")||"/var/lib/izakhono-standby/promotions");
const rootPrefix=resolve(arg("--root-prefix")||"/");
const testMode=process.env.IZAKHONO_PROMOTION_TEST==="1";

const dataDirs=[
  "izakhono-data",
  "izakhono-object",
  "izakhono-queue",
  "izakhono-auth",
  "izakhono-analytics",
  "izakhono-notify",
  "izakhono-ai-gateway",
  "izakhono-code"
];

const envFiles=[
  "data-node.env",
  "object-node.env",
  "queue-node.env",
  "auth-node.env",
  "analytics-node.env",
  "notify-node.env",
  "ai-gateway-node.env",
  "code-node.env"
];

function liveData(name){return join(rootPrefix,"var/lib",name);}
function stagedData(name){return join(resolve(stagedRoot),"var/lib",name);}
function liveEnv(name){return join(rootPrefix,"etc/izakhono",name);}
function stagedEnv(name){return join(resolve(stagedRoot),"etc/izakhono",name);}

function validateStaging(){
  if(!stagedRoot) fail("--staged-root is required");
  const root=resolve(stagedRoot);
  if(!existsSync(root)) fail("Staged root does not exist");
  for(const name of dataDirs){
    if(!existsSync(stagedData(name))) fail("Staged state missing: var/lib/"+name);
  }
  for(const name of envFiles){
    if(!existsSync(stagedEnv(name))) fail("Staged service environment missing: etc/izakhono/"+name);
  }
}

function manifestPath(id){return join(promotionRoot,id,"manifest.json");}

function apply(){
  validateStaging();
  mkdirSync(promotionRoot,{recursive:true});
  const id=randomUUID();
  const work=join(promotionRoot,id);
  const prepared=join(work,"prepared");
  const rollback=join(work,"rollback");
  const rollbackEnv=join(work,"rollback-env");
  mkdirSync(prepared,{recursive:true});
  mkdirSync(rollback,{recursive:true});
  mkdirSync(rollbackEnv,{recursive:true});

  const libRoot=join(rootPrefix,"var/lib");
  if(!existsSync(libRoot)) fail("Live /var/lib root does not exist");
  const workDevice=statSync(promotionRoot).dev;

  const manifest={
    product:"IZAKHONO STANDBY STATE TRANSACTION",
    id,
    status:"PREPARING",
    stagedRoot:resolve(stagedRoot),
    rootPrefix,
    dataDirs,
    envFiles,
    moved:[],
    configs:[],
    createdAt:new Date().toISOString()
  };
  writeFileSync(manifestPath(id),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});

  try{
    for(const name of dataDirs){
      const src=stagedData(name);
      const dst=join(prepared,name);
      copyArchive(src,dst);
      if(!existsSync(dst)) throw new Error("Prepared copy missing: "+name);

      const live=liveData(name);
      if(existsSync(live) && statSync(live).dev!==workDevice){
        throw new Error("Live state is on a different filesystem and cannot be atomically swapped: "+live);
      }
    }

    for(const name of envFiles){
      const live=liveEnv(name);
      const src=stagedEnv(name);
      mkdirSync(dirname(live),{recursive:true});
      if(existsSync(live)){
        const backup=join(rollbackEnv,name);
        copyArchive(live,backup);
        manifest.configs.push({name,hadOriginal:true,backup});
      }else{
        manifest.configs.push({name,hadOriginal:false,backup:null});
      }
      cpSync(src,live,{force:true,preserveTimestamps:true});
      if(!testMode && process.getuid?.()===0){
        command("chmod",["0600",live]);
        command("chown",["root:izakhono",live]);
      }
    }

    for(const name of dataDirs){
      const live=liveData(name);
      const old=join(rollback,name);
      const next=join(prepared,name);
      if(existsSync(live)){
        renameSync(live,old);
        manifest.moved.push({name,hadOriginal:true,old});
      }else{
        manifest.moved.push({name,hadOriginal:false,old:null});
      }
      renameSync(next,live);
      if(!testMode && process.getuid?.()===0){
        command("chown",["-R","izakhono:izakhono",live]);
      }
    }

    manifest.status="APPLIED";
    manifest.appliedAt=new Date().toISOString();
    writeFileSync(manifestPath(id),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
    process.stdout.write(JSON.stringify({status:"APPLIED",id,manifest:manifestPath(id),rollbackRoot:rollback},null,2)+"\n");
  }catch(error){
    for(const item of [...manifest.moved].reverse()){
      const live=liveData(item.name);
      try{
        if(existsSync(live)) safeRemove(live,rootPrefix);
        if(item.hadOriginal && item.old && existsSync(item.old)) renameSync(item.old,live);
      }catch{}
    }
    for(const item of manifest.configs){
      const live=liveEnv(item.name);
      try{
        if(item.hadOriginal && item.backup && existsSync(item.backup)) cpSync(item.backup,live,{force:true,preserveTimestamps:true});
        else if(existsSync(live)) rmSync(live,{force:true});
      }catch{}
    }
    manifest.status="ROLLED_BACK_DURING_APPLY";
    manifest.error=String(error?.message||error);
    manifest.failedAt=new Date().toISOString();
    writeFileSync(manifestPath(id),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
    throw error;
  }
}

function rollback(){
  const manifestArg=arg("--manifest");
  if(!manifestArg) fail("--manifest is required for rollback");
  const path=resolve(manifestArg);
  if(!inside(promotionRoot,path)) fail("Manifest outside promotion root");
  const manifest=JSON.parse(readFileSync(path,"utf8"));
  if(manifest.status!=="APPLIED") fail("Only APPLIED transactions can be rolled back");
  if(resolve(manifest.rootPrefix)!==rootPrefix) fail("Rollback root-prefix mismatch");

  for(const item of [...manifest.moved].reverse()){
    const live=liveData(item.name);
    const failed=join(dirname(path),"failed-live",item.name);
    mkdirSync(dirname(failed),{recursive:true});
    if(existsSync(live)) renameSync(live,failed);
    if(item.hadOriginal && item.old && existsSync(item.old)) renameSync(item.old,live);
  }
  for(const item of manifest.configs){
    const live=liveEnv(item.name);
    if(item.hadOriginal && item.backup && existsSync(item.backup)){
      cpSync(item.backup,live,{force:true,preserveTimestamps:true});
    }else if(existsSync(live)){
      rmSync(live,{force:true});
    }
  }
  manifest.status="ROLLED_BACK";
  manifest.rolledBackAt=new Date().toISOString();
  writeFileSync(path,JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
  process.stdout.write(JSON.stringify({status:"ROLLED_BACK",id:manifest.id,manifest:path},null,2)+"\n");
}

if(action==="apply") apply();
else if(action==="rollback") rollback();
else fail("Usage: standby-state-swap.mjs <apply|rollback> ...");

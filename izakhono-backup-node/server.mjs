
import { createServer } from "node:http";
import {
  createCipheriv, createDecipheriv, createHash,
  randomBytes, randomUUID, timingSafeEqual
} from "node:crypto";
import {
  appendFileSync, closeSync, copyFileSync, createReadStream, createWriteStream,
  existsSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync,
  rmSync, statSync, unlinkSync, writeFileSync
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8870);
const DB_PATH=resolve(process.env.IZAKHONO_BACKUP_DB || "./data/backup.sqlite");
const ARCHIVE_ROOT=resolve(process.env.IZAKHONO_BACKUP_ARCHIVE_ROOT || "./data/archives");
const RESTORE_ROOT=resolve(process.env.IZAKHONO_BACKUP_RESTORE_ROOT || "./data/restores");
const ADMIN_KEY=process.env.IZAKHONO_BACKUP_ADMIN_KEY || "";
const ENCRYPTION_RAW=process.env.IZAKHONO_BACKUP_ENCRYPTION_KEY || "";
const ALLOWED_SOURCE_ROOTS=(process.env.IZAKHONO_BACKUP_SOURCE_ALLOWLIST || "/etc/izakhono")
  .split(",").map(x=>resolve(x.trim())).filter(Boolean);
const MIRROR_ROOTS=(process.env.IZAKHONO_BACKUP_MIRROR_ROOTS || "")
  .split(",").map(x=>x.trim()).filter(Boolean).map(x=>resolve(x));
const INTERVAL_HOURS=Math.max(0,Number(process.env.IZAKHONO_BACKUP_INTERVAL_HOURS || 24));
const MAX_BODY=Math.min(1024*1024,Math.max(65536,Number(process.env.IZAKHONO_BACKUP_MAX_BODY_BYTES || 262144)));
const MAGIC=Buffer.from("IZBK1");
const activeSets=new Set();

function encryptionKey(){
  const key=Buffer.from(ENCRYPTION_RAW,"base64");
  if(key.length!==32) throw new Error("IZAKHONO_BACKUP_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
encryptionKey();

mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(ARCHIVE_ROOT,{recursive:true});
mkdirSync(RESTORE_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec([
  "PRAGMA journal_mode=WAL;",
  "PRAGMA synchronous=NORMAL;",
  "PRAGMA foreign_keys=ON;",
  "PRAGMA busy_timeout=5000;",
  "CREATE TABLE IF NOT EXISTS backup_sets(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,sources_json TEXT NOT NULL,retention_count INTEGER NOT NULL DEFAULT 7,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  "CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,set_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('running','complete','failed','pruned')),archive_path TEXT,sha256 TEXT,size_bytes INTEGER,mirror_json TEXT NOT NULL DEFAULT '[]',error TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),completed_at TEXT,verified_at TEXT,FOREIGN KEY(set_id) REFERENCES backup_sets(id) ON DELETE CASCADE);",
  "CREATE INDEX IF NOT EXISTS snapshots_set_time_idx ON snapshots(set_id,created_at DESC);",
  "CREATE TABLE IF NOT EXISTS audit_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,occurred_at TEXT NOT NULL DEFAULT (datetime('now')),action TEXT NOT NULL,target_ref TEXT,outcome TEXT NOT NULL,detail_json TEXT NOT NULL DEFAULT '{}');"
].join("\n"));

function json(res,status,body){
  const payload=JSON.stringify(body);
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":Buffer.byteLength(payload),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff"
  });
  res.end(payload);
}
function safeEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}
function admin(req){return Boolean(ADMIN_KEY)&&safeEqual(req.headers["x-izakhono-key"],ADMIN_KEY);}
function audit(action,target,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,target_ref,outcome,detail_json) VALUES(?,?,?,?)")
    .run(action,target??null,outcome,JSON.stringify(detail));
}

async function readJson(req,limit=MAX_BODY){
  let total=0;
  const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

function isWithin(root,path){
  return root===path || path.startsWith(root.endsWith(sep)?root:root+sep);
}
function normalizedAllowedRoots(){
  return ALLOWED_SOURCE_ROOTS.map(root=>{
    try{return realpathSync(root);}catch{return root;}
  });
}
function normalizeSources(values){
  if(!Array.isArray(values) || values.length<1 || values.length>50) throw new Error("INVALID_SOURCES");
  const roots=normalizedAllowedRoots();
  const seen=new Set();
  const out=[];
  for(const value of values){
    if(typeof value!=="string") throw new Error("INVALID_SOURCES");
    const absolute=resolve(value);
    if(!existsSync(absolute)) throw new Error("SOURCE_NOT_FOUND");
    const real=realpathSync(absolute);
    if(!roots.some(root=>isWithin(root,real))) throw new Error("SOURCE_NOT_ALLOWED");
    if(isWithin(real,ARCHIVE_ROOT) || isWithin(real,RESTORE_ROOT)) throw new Error("BACKUP_ROOT_INSIDE_SOURCE");
    if(!seen.has(real)){seen.add(real);out.push(real);}
  }
  return out;
}
function validSetName(v){return typeof v==="string" && /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(v);}
function snapshotById(id){return db.prepare("SELECT * FROM snapshots WHERE id=?").get(id) || null;}
function setById(id){return db.prepare("SELECT * FROM backup_sets WHERE id=?").get(id) || null;}

function childExit(child){
  return new Promise((resolve,reject)=>{
    let stderr="";
    child.stderr?.on("data",chunk=>{if(stderr.length<8000) stderr+=chunk.toString("utf8");});
    child.on("error",reject);
    child.on("close",code=>{
      if(code===0) resolve();
      else reject(new Error(stderr.trim() || "PROCESS_EXIT_"+code));
    });
  });
}

async function sha256File(path){
  const hash=createHash("sha256");
  for await(const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function archiveParts(path){
  const size=statSync(path).size;
  if(size<MAGIC.length+12+16+1) throw new Error("ARCHIVE_TOO_SMALL");
  const fd=openSync(path,"r");
  try{
    const magic=Buffer.alloc(MAGIC.length);
    readSync(fd,magic,0,magic.length,0);
    if(!magic.equals(MAGIC)) throw new Error("INVALID_ARCHIVE_MAGIC");
    const iv=Buffer.alloc(12);
    readSync(fd,iv,0,12,MAGIC.length);
    const tag=Buffer.alloc(16);
    readSync(fd,tag,0,16,size-16);
    return {size,iv,tag,cipherStart:MAGIC.length+12,cipherEnd:size-17};
  }finally{closeSync(fd);}
}

async function decryptToTar(path,mode,destination){
  const parts=archiveParts(path);
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),parts.iv);
  decipher.setAuthTag(parts.tag);
  const input=createReadStream(path,{start:parts.cipherStart,end:parts.cipherEnd});
  const args=mode==="list"
    ?["-tf","-"]
    :["-xf","-","-C",destination,"--no-same-owner","--no-same-permissions"];
  const tar=spawn("tar",args,{stdio:["pipe",mode==="list"?"ignore":"ignore","pipe"]});
  await Promise.all([pipeline(input,decipher,tar.stdin),childExit(tar)]);
}

function mirrorSnapshot(setName,archivePath,sha){
  const mirrors=[];
  for(const root of MIRROR_ROOTS){
    try{
      mkdirSync(root,{recursive:true});
      const dir=join(root,setName);
      mkdirSync(dir,{recursive:true});
      const dest=join(dir,archivePath.split(sep).at(-1));
      copyFileSync(archivePath,dest);
      writeFileSync(dest+".sha256",sha+"  "+dest.split(sep).at(-1)+"\n",{mode:0o600});
      mirrors.push({root,path:dest,status:"complete"});
    }catch(error){
      mirrors.push({root,status:"failed",error:String(error?.message||error)});
    }
  }
  return mirrors;
}

function pruneRetention(set){
  const rows=db.prepare("SELECT * FROM snapshots WHERE set_id=? AND state='complete' ORDER BY created_at DESC").all(set.id);
  const old=rows.slice(Number(set.retention_count));
  for(const snap of old){
    try{if(snap.archive_path && existsSync(snap.archive_path)) unlinkSync(snap.archive_path);}catch{}
    try{
      for(const mirror of JSON.parse(snap.mirror_json||"[]")){
        if(mirror.path && existsSync(mirror.path)) unlinkSync(mirror.path);
        if(mirror.path && existsSync(mirror.path+".sha256")) unlinkSync(mirror.path+".sha256");
      }
    }catch{}
    db.prepare("UPDATE snapshots SET state='pruned' WHERE id=?").run(snap.id);
    audit("snapshot.prune",snap.id,"success",{setId:set.id});
  }
}

async function createSnapshot(set){
  if(activeSets.has(set.id)) throw new Error("BACKUP_ALREADY_RUNNING");
  activeSets.add(set.id);
  const id=randomUUID();
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const setDir=join(ARCHIVE_ROOT,set.name);
  mkdirSync(setDir,{recursive:true});
  const finalPath=join(setDir,stamp+"-"+id+".izbk");
  const tempPath=finalPath+".tmp";
  db.prepare("INSERT INTO snapshots(id,set_id,state,archive_path) VALUES(?,?,'running',?)").run(id,set.id,finalPath);
  audit("snapshot.start",id,"success",{setId:set.id});
  try{
    const sources=normalizeSources(JSON.parse(set.sources_json));
    const relative=sources.map(x=>x.replace(/^\/+/, ""));
    const tar=spawn("tar",["-C","/","-cf","-",...relative],{stdio:["ignore","pipe","pipe"]});
    const iv=randomBytes(12);
    const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
    const out=createWriteStream(tempPath,{mode:0o600});
    out.write(MAGIC);
    out.write(iv);
    await Promise.all([pipeline(tar.stdout,cipher,out),childExit(tar)]);
    appendFileSync(tempPath,cipher.getAuthTag());
    renameSync(tempPath,finalPath);

    const sha=await sha256File(finalPath);
    const size=statSync(finalPath).size;
    const mirrors=mirrorSnapshot(set.name,finalPath,sha);
    db.prepare("UPDATE snapshots SET state='complete',sha256=?,size_bytes=?,mirror_json=?,completed_at=datetime('now'),error=NULL WHERE id=?")
      .run(sha,size,JSON.stringify(mirrors),id);
    audit("snapshot.complete",id,"success",{setId:set.id,size,sha256:sha,mirrors});
    pruneRetention(set);
    return snapshotById(id);
  }catch(error){
    try{if(existsSync(tempPath)) unlinkSync(tempPath);}catch{}
    try{if(existsSync(finalPath)) unlinkSync(finalPath);}catch{}
    db.prepare("UPDATE snapshots SET state='failed',error=?,completed_at=datetime('now') WHERE id=?")
      .run(String(error?.message||error).slice(0,2000),id);
    audit("snapshot.complete",id,"failed",{setId:set.id,error:String(error?.message||error)});
    throw error;
  }finally{
    activeSets.delete(set.id);
  }
}

async function verifySnapshot(snapshot){
  if(snapshot.state!=="complete") throw new Error("SNAPSHOT_NOT_COMPLETE");
  if(!snapshot.archive_path || !existsSync(snapshot.archive_path)) throw new Error("ARCHIVE_NOT_FOUND");
  const actual=await sha256File(snapshot.archive_path);
  if(actual!==snapshot.sha256) throw new Error("SHA256_MISMATCH");
  await decryptToTar(snapshot.archive_path,"list",null);
  db.prepare("UPDATE snapshots SET verified_at=datetime('now') WHERE id=?").run(snapshot.id);
  audit("snapshot.verify",snapshot.id,"success",{sha256:actual});
  return {verified:true,sha256:actual};
}

async function restoreSnapshot(snapshot,destinationName){
  if(snapshot.state!=="complete") throw new Error("SNAPSHOT_NOT_COMPLETE");
  if(typeof destinationName!=="string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(destinationName)) throw new Error("INVALID_RESTORE_DESTINATION");
  const dest=join(RESTORE_ROOT,destinationName);
  if(existsSync(dest)) throw new Error("RESTORE_DESTINATION_EXISTS");
  mkdirSync(dest,{recursive:false,mode:0o700});
  try{
    await decryptToTar(snapshot.archive_path,"extract",dest);
    audit("snapshot.restore",snapshot.id,"success",{destination:dest});
    return {restored:true,destination:dest};
  }catch(error){
    try{rmSync(dest,{recursive:true,force:true});}catch{}
    audit("snapshot.restore",snapshot.id,"failed",{error:String(error?.message||error)});
    throw error;
  }
}

async function runEnabled(){
  const sets=db.prepare("SELECT * FROM backup_sets WHERE enabled=1 ORDER BY name").all();
  const results=[];
  for(const set of sets){
    try{
      const snapshot=await createSnapshot(set);
      results.push({set:set.name,status:"complete",snapshotId:snapshot.id});
    }catch(error){
      results.push({set:set.name,status:"failed",error:String(error?.message||error)});
    }
  }
  return results;
}

if(INTERVAL_HOURS>0){
  setInterval(()=>{runEnabled().catch(error=>console.error("scheduled backup",error));},INTERVAL_HOURS*3600000).unref();
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO BACKUP NODE",
        status:"healthy",
        backupSets:Number(db.prepare("SELECT count(*) AS count FROM backup_sets WHERE enabled=1").get()?.count||0),
        completeSnapshots:Number(db.prepare("SELECT count(*) AS count FROM snapshots WHERE state='complete'").get()?.count||0),
        mirrorsConfigured:MIRROR_ROOTS.length,
        encryption:"AES-256-GCM",
        thirdPartyBackupRequired:false
      });
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/sets"){
      const body=await readJson(req);
      const name=String(body?.name||"").trim();
      if(!validSetName(name)) return json(res,400,{error:"Invalid backup set name"});
      const sources=normalizeSources(body?.sources);
      const retention=Math.min(365,Math.max(1,Number(body?.retentionCount||7)));
      const id=randomUUID();
      db.prepare("INSERT INTO backup_sets(id,name,sources_json,retention_count,enabled) VALUES(?,?,?,?,?)")
        .run(id,name,JSON.stringify(sources),retention,body?.enabled===false?0:1);
      audit("set.create",id,"success",{name,sources,retention});
      return json(res,201,{set:{id,name,sources,retentionCount:retention,enabled:body?.enabled!==false}});
    }

    if(req.method==="GET" && url.pathname==="/v1/sets"){
      const rows=db.prepare("SELECT * FROM backup_sets ORDER BY name").all().map(row=>({
        id:row.id,name:row.name,sources:JSON.parse(row.sources_json),
        retentionCount:row.retention_count,enabled:Boolean(row.enabled),
        createdAt:row.created_at,updatedAt:row.updated_at
      }));
      return json(res,200,{sets:rows});
    }

    const setSnap=url.pathname.match(/^\/v1\/sets\/([^/]+)\/snapshots$/);
    if(setSnap && req.method==="POST"){
      const set=setById(setSnap[1]);
      if(!set) return json(res,404,{error:"Backup set not found"});
      const snapshot=await createSnapshot(set);
      return json(res,201,{snapshot});
    }
    if(setSnap && req.method==="GET"){
      const set=setById(setSnap[1]);
      if(!set) return json(res,404,{error:"Backup set not found"});
      const rows=db.prepare("SELECT * FROM snapshots WHERE set_id=? ORDER BY created_at DESC LIMIT 200").all(set.id);
      return json(res,200,{setId:set.id,snapshots:rows});
    }

    const verify=url.pathname.match(/^\/v1\/snapshots\/([^/]+)\/verify$/);
    if(verify && req.method==="POST"){
      const snapshot=snapshotById(verify[1]);
      if(!snapshot) return json(res,404,{error:"Snapshot not found"});
      return json(res,200,await verifySnapshot(snapshot));
    }

    const restore=url.pathname.match(/^\/v1\/snapshots\/([^/]+)\/restore$/);
    if(restore && req.method==="POST"){
      const snapshot=snapshotById(restore[1]);
      if(!snapshot) return json(res,404,{error:"Snapshot not found"});
      const body=await readJson(req);
      return json(res,201,await restoreSnapshot(snapshot,body?.destinationName));
    }

    if(req.method==="POST" && url.pathname==="/v1/run-enabled"){
      return json(res,200,{results:await runEnabled()});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      const limit=Math.min(1000,Math.max(1,Number(url.searchParams.get("limit")||100)));
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT ?").all(limit)});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if([
      "INVALID_SOURCES","SOURCE_NOT_FOUND","SOURCE_NOT_ALLOWED","BACKUP_ROOT_INSIDE_SOURCE",
      "BACKUP_ALREADY_RUNNING","SNAPSHOT_NOT_COMPLETE","ARCHIVE_NOT_FOUND","SHA256_MISMATCH",
      "INVALID_ARCHIVE_MAGIC","ARCHIVE_TOO_SMALL","INVALID_RESTORE_DESTINATION","RESTORE_DESTINATION_EXISTS"
    ].includes(message)) return json(res,400,{error:message});
    if(String(message).includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log("IZAKHONO BACKUP NODE listening on http://"+HOST+":"+PORT);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_BACKUP_ADMIN_KEY missing; admin API will reject requests.");
});

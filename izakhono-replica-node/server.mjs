
import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import {
  createCipheriv, createDecipheriv, createHash,
  randomBytes, randomUUID, timingSafeEqual
} from "node:crypto";
import {
  createReadStream, createWriteStream, existsSync, mkdirSync,
  readdirSync, renameSync, rmSync, statSync, unlinkSync
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8890);
const DB_PATH=resolve(process.env.IZAKHONO_REPLICA_DB || "./data/replica.sqlite");
const REPLICA_ROOT=resolve(process.env.IZAKHONO_REPLICA_ROOT || "./data/replicas");
const SOURCE_ARCHIVE_ROOT=resolve(process.env.IZAKHONO_REPLICA_SOURCE_ARCHIVE_ROOT || "/var/lib/izakhono-backup/archives");
const NODE_ID=process.env.IZAKHONO_REPLICA_NODE_ID || "primary";
const ADMIN_KEY=process.env.IZAKHONO_REPLICA_ADMIN_KEY || "";
const RECEIVE_KEY=process.env.IZAKHONO_REPLICA_RECEIVE_KEY || "";
const ENCRYPTION_RAW=process.env.IZAKHONO_REPLICA_ENCRYPTION_KEY || "";
const TARGET_ALLOWLIST=(process.env.IZAKHONO_REPLICA_TARGET_ALLOWLIST || "127.0.0.1,localhost,::1")
  .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
const MAX_RECEIVE_BYTES=Math.max(1024*1024,Number(process.env.IZAKHONO_REPLICA_MAX_BYTES || 500*1024*1024*1024));
const REQUEST_TIMEOUT_MS=Math.min(3600000,Math.max(5000,Number(process.env.IZAKHONO_REPLICA_TIMEOUT_MS || 300000)));
const MAX_ADMIN_BODY=Math.min(1024*1024,Math.max(65536,Number(process.env.IZAKHONO_REPLICA_MAX_BODY_BYTES || 262144)));

function key(){
  const value=Buffer.from(ENCRYPTION_RAW,"base64");
  if(value.length!==32) throw new Error("IZAKHONO_REPLICA_ENCRYPTION_KEY must decode to 32 bytes");
  return value;
}
key();
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(NODE_ID)) throw new Error("Invalid IZAKHONO_REPLICA_NODE_ID");

mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(REPLICA_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec([
  "PRAGMA journal_mode=WAL;",
  "PRAGMA synchronous=NORMAL;",
  "PRAGMA foreign_keys=ON;",
  "PRAGMA busy_timeout=5000;",
  "CREATE TABLE IF NOT EXISTS peers(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,base_url TEXT NOT NULL,receive_key_encrypted TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  "CREATE TABLE IF NOT EXISTS replica_objects(id TEXT PRIMARY KEY,source_node TEXT NOT NULL,object_key TEXT NOT NULL,original_relative_path TEXT,sha256 TEXT NOT NULL,size_bytes INTEGER NOT NULL,stored_path TEXT NOT NULL,received_at TEXT NOT NULL DEFAULT (datetime('now')),verified_at TEXT,UNIQUE(source_node,object_key));",
  "CREATE TABLE IF NOT EXISTS replications(id TEXT PRIMARY KEY,peer_id TEXT NOT NULL,source_path TEXT NOT NULL,object_key TEXT NOT NULL,sha256 TEXT NOT NULL,size_bytes INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('sending','complete','duplicate','failed')),http_status INTEGER,error TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),completed_at TEXT,FOREIGN KEY(peer_id) REFERENCES peers(id) ON DELETE CASCADE);",
  "CREATE INDEX IF NOT EXISTS replications_peer_time_idx ON replications(peer_id,created_at DESC);",
  "CREATE TABLE IF NOT EXISTS audit_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,occurred_at TEXT NOT NULL DEFAULT (datetime('now')),action TEXT NOT NULL,target_ref TEXT,outcome TEXT NOT NULL,detail_json TEXT NOT NULL DEFAULT '{}');"
].join("\n"));

function json(res,status,body,headers={}){
  const payload=JSON.stringify(body);
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":Buffer.byteLength(payload),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    ...headers
  });
  res.end(payload);
}
function equal(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}
function admin(req){return Boolean(ADMIN_KEY)&&equal(req.headers["x-izakhono-key"],ADMIN_KEY);}
function receiver(req){return Boolean(RECEIVE_KEY)&&equal(req.headers["x-replica-key"],RECEIVE_KEY);}
function audit(action,target,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,target_ref,outcome,detail_json) VALUES(?,?,?,?)")
    .run(action,target??null,outcome,JSON.stringify(detail));
}
function encrypt(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key(),iv);
  const ct=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:tag.toString("base64"),ct:ct.toString("base64")});
}
function decrypt(value){
  const env=JSON.parse(value);
  if(env.v!==1) throw new Error("UNSUPPORTED_SECRET_ENVELOPE");
  const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(env.iv,"base64"));
  decipher.setAuthTag(Buffer.from(env.tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(env.ct,"base64")),decipher.final()]).toString("utf8");
}
async function readJson(req){
  let total=0;const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_ADMIN_BODY) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}
function inside(root,path){
  return path===root || path.startsWith(root.endsWith(sep)?root:root+sep);
}
function safeArchivePath(value){
  if(typeof value!=="string") throw new Error("INVALID_ARCHIVE_PATH");
  const path=resolve(value);
  if(!inside(SOURCE_ARCHIVE_ROOT,path)) throw new Error("ARCHIVE_OUTSIDE_SOURCE_ROOT");
  if(extname(path)!==".izbk") throw new Error("ARCHIVE_EXTENSION_REQUIRED");
  if(!existsSync(path) || !statSync(path).isFile()) throw new Error("ARCHIVE_NOT_FOUND");
  return path;
}
function validPart(value){
  return typeof value==="string" && /^[A-Za-z0-9][A-Za-z0-9._-]{1,199}$/.test(value);
}
function safePeerUrl(value){
  let u;
  try{u=new URL(value);}catch{throw new Error("INVALID_PEER_URL");}
  if(u.username || u.password || u.search || u.hash) throw new Error("INVALID_PEER_URL");
  const host=u.hostname.toLowerCase();
  if(!TARGET_ALLOWLIST.includes(host)) throw new Error("PEER_HOST_NOT_ALLOWED");
  const local=["127.0.0.1","localhost","::1"].includes(host);
  if(!local && u.protocol!=="https:") throw new Error("EXTERNAL_PEER_REQUIRES_HTTPS");
  if(local && !["http:","https:"].includes(u.protocol)) throw new Error("INVALID_PEER_URL");
  return u.origin + u.pathname.replace(/\/$/,"");
}
async function shaFile(path){
  const hash=createHash("sha256");
  for await(const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function objectKeyFor(path){
  const rel=relative(SOURCE_ARCHIVE_ROOT,path).replace(/\\/g,"/");
  const prefix=createHash("sha256").update(rel).digest("hex").slice(0,16);
  const clean=basename(path).replace(/[^A-Za-z0-9._-]/g,"_").slice(-150);
  return prefix+"-"+clean;
}
function listArchives(root=SOURCE_ARCHIVE_ROOT){
  if(!existsSync(root)) return [];
  const out=[];
  function walk(dir){
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      const full=join(dir,entry.name);
      if(entry.isDirectory()) walk(full);
      else if(entry.isFile() && entry.name.endsWith(".izbk")) out.push(full);
    }
  }
  walk(root);
  return out.sort();
}
function requestUpload(peer,path,objectKey,sha,size,relativePath){
  return new Promise((resolvePromise,reject)=>{
    const target=new URL(
      peer.base_url.replace(/\/$/,"")+
      "/v1/receive/"+encodeURIComponent(NODE_ID)+"/"+encodeURIComponent(objectKey)
    );
    const requester=target.protocol==="https:"?httpsRequest:httpRequest;
    const req=requester({
      protocol:target.protocol,
      hostname:target.hostname,
      port:target.port||undefined,
      method:"PUT",
      path:target.pathname,
      headers:{
        "content-type":"application/octet-stream",
        "content-length":String(size),
        "x-replica-key":decrypt(peer.receive_key_encrypted),
        "x-content-sha256":sha,
        "x-original-relative-path":Buffer.from(relativePath,"utf8").toString("base64")
      },
      timeout:REQUEST_TIMEOUT_MS
    },res=>{
      const chunks=[];let total=0;
      res.on("data",chunk=>{
        total+=chunk.length;
        if(total<256*1024) chunks.push(chunk);
      });
      res.on("end",()=>{
        const text=Buffer.concat(chunks).toString("utf8");
        let body={};
        try{body=text?JSON.parse(text):{};}catch{body={raw:text.slice(0,1000)};}
        resolvePromise({status:res.statusCode||0,body});
      });
    });
    req.on("timeout",()=>req.destroy(new Error("REPLICA_TIMEOUT")));
    req.on("error",reject);
    createReadStream(path).on("error",reject).pipe(req);
  });
}
async function replicateOne(peer,path){
  path=safeArchivePath(path);
  const size=statSync(path).size;
  if(size>MAX_RECEIVE_BYTES) throw new Error("ARCHIVE_TOO_LARGE");
  const sha=await shaFile(path);
  const objectKey=objectKeyFor(path);
  const relativePath=relative(SOURCE_ARCHIVE_ROOT,path).replace(/\\/g,"/");
  const id=randomUUID();
  db.prepare("INSERT INTO replications(id,peer_id,source_path,object_key,sha256,size_bytes,state) VALUES(?,?,?,?,?,?,'sending')")
    .run(id,peer.id,path,objectKey,sha,size);
  audit("replication.start",id,"success",{peerId:peer.id,objectKey,sha256:sha,size});
  try{
    const response=await requestUpload(peer,path,objectKey,sha,size,relativePath);
    if(response.status<200 || response.status>=300){
      throw Object.assign(new Error(response.body?.error||("PEER_HTTP_"+response.status)),{httpStatus:response.status});
    }
    const state=response.body?.duplicate?"duplicate":"complete";
    db.prepare("UPDATE replications SET state=?,http_status=?,completed_at=datetime('now'),error=NULL WHERE id=?")
      .run(state,response.status,id);
    audit("replication.complete",id,"success",{peerId:peer.id,state,httpStatus:response.status});
    return db.prepare("SELECT * FROM replications WHERE id=?").get(id);
  }catch(error){
    db.prepare("UPDATE replications SET state='failed',http_status=?,error=?,completed_at=datetime('now') WHERE id=?")
      .run(error?.httpStatus||null,String(error?.message||error).slice(0,2000),id);
    audit("replication.complete",id,"failed",{peerId:peer.id,error:String(error?.message||error)});
    throw error;
  }
}
async function receiveObject(req,sourceNode,objectKey){
  if(!receiver(req)) throw Object.assign(new Error("RECEIVER_UNAUTHORIZED"),{status:401});
  if(!validPart(sourceNode) || !validPart(objectKey)) throw Object.assign(new Error("INVALID_OBJECT_ID"),{status:400});
  const expected=String(req.headers["x-content-sha256"]||"").toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(expected)) throw Object.assign(new Error("INVALID_SHA256"),{status:400});
  const length=Number(req.headers["content-length"]||0);
  if(!Number.isFinite(length) || length<=0 || length>MAX_RECEIVE_BYTES){
    throw Object.assign(new Error("INVALID_CONTENT_LENGTH"),{status:413});
  }

  const existing=db.prepare("SELECT * FROM replica_objects WHERE source_node=? AND object_key=?").get(sourceNode,objectKey);
  if(existing){
    req.resume();
    if(existing.sha256===expected && Number(existing.size_bytes)===length && existsSync(existing.stored_path)){
      return {duplicate:true,object:existing};
    }
    throw Object.assign(new Error("IMMUTABLE_OBJECT_CONFLICT"),{status:409});
  }

  const sourceDir=join(REPLICA_ROOT,sourceNode);
  mkdirSync(sourceDir,{recursive:true,mode:0o700});
  const finalPath=join(sourceDir,objectKey);
  const tempPath=finalPath+".tmp-"+randomUUID();
  const out=createWriteStream(tempPath,{flags:"wx",mode:0o600});
  const hash=createHash("sha256");
  let received=0;

  return await new Promise((resolvePromise,reject)=>{
    let settled=false;
    function fail(error){
      if(settled) return;
      settled=true;
      try{out.destroy();}catch{}
      try{rmSync(tempPath,{force:true});}catch{}
      reject(error);
    }
    req.on("data",chunk=>{
      received+=chunk.length;
      if(received>MAX_RECEIVE_BYTES){
        req.destroy();
        fail(Object.assign(new Error("REPLICA_TOO_LARGE"),{status:413}));
        return;
      }
      hash.update(chunk);
    });
    req.on("error",fail);
    out.on("error",fail);
    out.on("finish",()=>{
      if(settled) return;
      try{
        if(received!==length) throw Object.assign(new Error("CONTENT_LENGTH_MISMATCH"),{status:400});
        const actual=hash.digest("hex");
        if(actual!==expected) throw Object.assign(new Error("SHA256_MISMATCH"),{status:400});
        renameSync(tempPath,finalPath);
        let original=null;
        try{
          const raw=String(req.headers["x-original-relative-path"]||"");
          if(raw) original=Buffer.from(raw,"base64").toString("utf8").slice(0,1000);
        }catch{}
        const id=randomUUID();
        db.prepare("INSERT INTO replica_objects(id,source_node,object_key,original_relative_path,sha256,size_bytes,stored_path) VALUES(?,?,?,?,?,?,?)")
          .run(id,sourceNode,objectKey,original,actual,received,finalPath);
        const row=db.prepare("SELECT * FROM replica_objects WHERE id=?").get(id);
        audit("replica.receive",id,"success",{sourceNode,objectKey,sha256:actual,size:received});
        settled=true;
        resolvePromise({duplicate:false,object:row});
      }catch(error){fail(error);}
    });
    req.pipe(out);
  });
}
async function verifyObject(row){
  if(!existsSync(row.stored_path)) throw new Error("REPLICA_OBJECT_MISSING");
  const actual=await shaFile(row.stored_path);
  if(actual!==row.sha256) throw new Error("REPLICA_SHA256_MISMATCH");
  db.prepare("UPDATE replica_objects SET verified_at=datetime('now') WHERE id=?").run(row.id);
  audit("replica.verify",row.id,"success",{sha256:actual});
  return {verified:true,sha256:actual,sizeBytes:statSync(row.stored_path).size};
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO REPLICA NODE",
        status:"healthy",
        nodeId:NODE_ID,
        replicaObjects:Number(db.prepare("SELECT count(*) AS count FROM replica_objects").get()?.count||0),
        peers:Number(db.prepare("SELECT count(*) AS count FROM peers WHERE enabled=1").get()?.count||0),
        sourceArchiveAvailable:existsSync(SOURCE_ARCHIVE_ROOT),
        backupRecoveryKeyRequiredForReplication:false,
        thirdPartyReplicationRequired:false
      });
    }

    const receive=url.pathname.match(/^\/v1\/receive\/([^/]+)\/([^/]+)$/);
    if(req.method==="PUT" && receive){
      const result=await receiveObject(req,decodeURIComponent(receive[1]),decodeURIComponent(receive[2]));
      return json(res,result.duplicate?200:201,result);
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/peers"){
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!validPart(name)) return json(res,400,{error:"Invalid peer name"});
      const baseUrl=safePeerUrl(body?.baseUrl);
      if(typeof body?.receiveKey!=="string" || body.receiveKey.length<24) return json(res,400,{error:"Peer receive key required"});
      const id=randomUUID();
      db.prepare("INSERT INTO peers(id,name,base_url,receive_key_encrypted) VALUES(?,?,?,?)")
        .run(id,name,baseUrl,encrypt(body.receiveKey));
      audit("peer.create",id,"success",{name,baseUrl});
      return json(res,201,{peer:{id,name,baseUrl}});
    }

    if(req.method==="GET" && url.pathname==="/v1/peers"){
      const rows=db.prepare("SELECT id,name,base_url,enabled,created_at,updated_at FROM peers ORDER BY name").all();
      return json(res,200,{peers:rows});
    }

    if(req.method==="POST" && url.pathname==="/v1/replicate"){
      const body=await readJson(req);
      const peer=db.prepare("SELECT * FROM peers WHERE id=? AND enabled=1").get(body?.peerId);
      if(!peer) return json(res,404,{error:"Peer not found"});
      const replication=await replicateOne(peer,body?.archivePath);
      return json(res,201,{replication});
    }

    const sync=url.pathname.match(/^\/v1\/peers\/([^/]+)\/sync$/);
    if(req.method==="POST" && sync){
      const peer=db.prepare("SELECT * FROM peers WHERE id=? AND enabled=1").get(sync[1]);
      if(!peer) return json(res,404,{error:"Peer not found"});
      const paths=listArchives();
      const results=[];
      for(const path of paths){
        try{
          const row=await replicateOne(peer,path);
          results.push({path,state:row.state,replicationId:row.id});
        }catch(error){
          results.push({path,state:"failed",error:String(error?.message||error)});
        }
      }
      return json(res,200,{peerId:peer.id,archives:paths.length,results});
    }

    if(req.method==="GET" && url.pathname==="/v1/objects"){
      const rows=db.prepare("SELECT id,source_node,object_key,original_relative_path,sha256,size_bytes,received_at,verified_at FROM replica_objects ORDER BY received_at DESC LIMIT 1000").all();
      return json(res,200,{objects:rows});
    }

    const verify=url.pathname.match(/^\/v1\/objects\/([^/]+)\/verify$/);
    if(req.method==="POST" && verify){
      const row=db.prepare("SELECT * FROM replica_objects WHERE id=?").get(verify[1]);
      if(!row) return json(res,404,{error:"Replica object not found"});
      return json(res,200,await verifyObject(row));
    }

    if(req.method==="GET" && url.pathname==="/v1/replications"){
      const limit=Math.min(1000,Math.max(1,Number(url.searchParams.get("limit")||100)));
      return json(res,200,{replications:db.prepare("SELECT * FROM replications ORDER BY created_at DESC LIMIT ?").all(limit)});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT 1000").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    const status=Number(error?.status||0);
    if(status) return json(res,status,{error:message});
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:message});
    if([
      "INVALID_ARCHIVE_PATH","ARCHIVE_OUTSIDE_SOURCE_ROOT","ARCHIVE_EXTENSION_REQUIRED","ARCHIVE_NOT_FOUND",
      "ARCHIVE_TOO_LARGE","INVALID_PEER_URL","PEER_HOST_NOT_ALLOWED","EXTERNAL_PEER_REQUIRES_HTTPS",
      "REPLICA_OBJECT_MISSING","REPLICA_SHA256_MISMATCH"
    ].includes(message)) return json(res,400,{error:message});
    if(String(message).includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log("IZAKHONO REPLICA NODE listening on http://"+HOST+":"+PORT+" node="+NODE_ID);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_REPLICA_ADMIN_KEY missing; admin API will reject requests.");
  if(!RECEIVE_KEY) console.warn("WARNING: IZAKHONO_REPLICA_RECEIVE_KEY missing; receive endpoint will reject requests.");
});

import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8900);
const ORIGIN_RAW=process.env.IZAKHONO_PACKAGE_UPSTREAM || "https://registry.npmjs.org";
const PUBLIC_URL=(process.env.IZAKHONO_PACKAGE_PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/,"");
const ADMIN_KEY=process.env.IZAKHONO_PACKAGE_KEY || "";
const CACHE_ROOT=resolve(process.env.IZAKHONO_PACKAGE_CACHE || "./cache");
const DB_PATH=resolve(process.env.IZAKHONO_PACKAGE_DB || "./data/package-node.sqlite");
const TMP_ROOT=resolve(process.env.IZAKHONO_PACKAGE_TMP || "./tmp");
const MAX_OBJECT=Number(process.env.IZAKHONO_PACKAGE_MAX_BYTES || 512*1024*1024);
const METADATA_TTL=Math.max(0,Number(process.env.IZAKHONO_PACKAGE_METADATA_TTL_SECONDS || 300));
const TARBALL_TTL=Math.max(60,Number(process.env.IZAKHONO_PACKAGE_TARBALL_TTL_SECONDS || 31536000));

const ORIGIN=new URL(ORIGIN_RAW);
if(!["https:","http:"].includes(ORIGIN.protocol)) throw new Error("Package upstream must be http or https");
if(ORIGIN.username || ORIGIN.password) throw new Error("Package upstream credentials are not allowed in URL");

mkdirSync(CACHE_ROOT,{recursive:true});
mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(TMP_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS cache_entries(
    cache_key TEXT PRIMARY KEY,
    request_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content_type TEXT,
    content_length INTEGER NOT NULL,
    etag TEXT,
    last_modified TEXT,
    fetched_at INTEGER NOT NULL,
    ttl_seconds INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 200,
    hits INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS cache_fetched_idx ON cache_entries(fetched_at);

  CREATE TABLE IF NOT EXISTS audit_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    cache_key TEXT,
    outcome TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );
`);

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

function secureEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}

function authenticated(req){
  return Boolean(ADMIN_KEY) && secureEqual(req.headers["x-izakhono-key"],ADMIN_KEY);
}

function cacheKey(path){ return createHash("sha256").update(path).digest("hex"); }

function cachePath(key){
  return resolve(CACHE_ROOT,key.slice(0,2),key.slice(2,4),key);
}

function audit(action,key,outcome,detail={}){
  db.prepare(`
    INSERT INTO audit_ledger(action,cache_key,outcome,detail_json)
    VALUES(?,?,?,?)
  `).run(action,key??null,outcome,JSON.stringify(detail));
}

function entryFor(key){
  return db.prepare("SELECT * FROM cache_entries WHERE cache_key=?").get(key);
}

function isFresh(entry){
  return Boolean(entry) && Math.floor(Date.now()/1000) < Number(entry.fetched_at)+Number(entry.ttl_seconds);
}

function headersFor(entry,cacheState){
  return {
    "content-type":entry.content_type||"application/octet-stream",
    "content-length":String(entry.content_length),
    "etag":entry.etag||`"sha256-${entry.sha256}"`,
    "last-modified":entry.last_modified||new Date(Number(entry.fetched_at)*1000).toUTCString(),
    "cache-control":"private, max-age=0, must-revalidate",
    "x-content-type-options":"nosniff",
    "x-izakhono-package-cache":cacheState,
    "x-izakhono-package-sha256":entry.sha256
  };
}

function serveEntry(req,res,entry,state){
  if(!entry || !existsSync(entry.file_path)) return false;
  db.prepare("UPDATE cache_entries SET hits=hits+1 WHERE cache_key=?").run(entry.cache_key);
  res.writeHead(200,headersFor(entry,state));
  if(req.method==="HEAD") return res.end(),true;
  createReadStream(entry.file_path).pipe(res);
  return true;
}

function safePath(url){
  const decoded=decodeURIComponent(url.pathname);
  if(decoded.includes("\\") || decoded.split("/").some(p=>p===".." || p===".")) throw new Error("INVALID_PATH");
  return url.pathname+url.search;
}

function upstreamUrl(requestPath){
  return new URL(requestPath,ORIGIN);
}

function rewriteMetadata(value){
  if(!value || typeof value!=="object") return value;
  const copy=Array.isArray(value)?[]:{};
  for(const [k,v] of Object.entries(value)){
    if(k==="tarball" && typeof v==="string"){
      try{
        const u=new URL(v);
        if(u.origin===ORIGIN.origin) copy[k]=PUBLIC_URL+u.pathname+u.search;
        else copy[k]=v;
      }catch{copy[k]=v;}
    }else{
      copy[k]=(v && typeof v==="object")?rewriteMetadata(v):v;
    }
  }
  return copy;
}

async function cacheMetadata(response,key,requestPath,tmp){
  const declared=Number(response.headers.get("content-length")||0);
  if(declared>20*1024*1024) throw new Error("METADATA_TOO_LARGE");
  const raw=Buffer.from(await response.arrayBuffer());
  if(raw.length>20*1024*1024) throw new Error("METADATA_TOO_LARGE");

  let body=raw;
  try{
    const parsed=JSON.parse(raw.toString("utf8"));
    body=Buffer.from(JSON.stringify(rewriteMetadata(parsed)));
  }catch{}

  const sha=createHash("sha256").update(body).digest("hex");
  mkdirSync(dirname(cachePath(key)),{recursive:true});
  await new Promise((resolvePromise,reject)=>{
    const out=createWriteStream(tmp,{flags:"wx"});
    out.on("error",reject);
    out.on("finish",resolvePromise);
    out.end(body);
  });
  renameSync(tmp,cachePath(key));
  return {size:body.length,sha};
}

async function cacheBinary(response,key,tmp){
  const declared=Number(response.headers.get("content-length")||0);
  if(declared>MAX_OBJECT) throw new Error("OBJECT_TOO_LARGE");
  if(!response.body) throw new Error("UPSTREAM_BODY_MISSING");

  const hash=createHash("sha256");
  let size=0;
  const meter=new Transform({
    transform(chunk,_enc,cb){
      size+=chunk.length;
      if(size>MAX_OBJECT) return cb(new Error("OBJECT_TOO_LARGE"));
      hash.update(chunk);
      cb(null,chunk);
    }
  });

  await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(tmp,{flags:"wx"}));
  mkdirSync(dirname(cachePath(key)),{recursive:true});
  renameSync(tmp,cachePath(key));
  return {size,sha:hash.digest("hex")};
}

async function fetchAndCache(requestPath,key,existing){
  const headers={accept:"*/*","user-agent":"IZAKHONO-PACKAGE-NODE/0.1"};
  if(existing?.etag) headers["if-none-match"]=existing.etag;
  if(existing?.last_modified) headers["if-modified-since"]=existing.last_modified;

  const response=await fetch(upstreamUrl(requestPath),{
    method:"GET",
    headers,
    redirect:"follow",
    cache:"no-store",
    signal:AbortSignal.timeout(30000)
  });

  if(response.status===304 && existing){
    db.prepare("UPDATE cache_entries SET fetched_at=?,hits=hits+1 WHERE cache_key=?")
      .run(Math.floor(Date.now()/1000),key);
    audit("cache.revalidate",key,"success",{status:304});
    return entryFor(key);
  }

  if(!response.ok) throw new Error("UPSTREAM_STATUS_"+response.status);

  const contentType=response.headers.get("content-type")||"application/octet-stream";
  const isMetadata=contentType.includes("json");
  const ttl=isMetadata?METADATA_TTL:TARBALL_TTL;
  const tmp=resolve(TMP_ROOT,key+"-"+Date.now()+".part");
  rmSync(tmp,{force:true});

  let stored;
  try{
    stored=isMetadata
      ? await cacheMetadata(response,key,requestPath,tmp)
      : await cacheBinary(response,key,tmp);
  }catch(error){
    rmSync(tmp,{force:true});
    throw error;
  }

  const path=cachePath(key);
  db.prepare(`
    INSERT INTO cache_entries(
      cache_key,request_path,file_path,content_type,content_length,etag,last_modified,
      fetched_at,ttl_seconds,sha256,status,hits
    ) VALUES(?,?,?,?,?,?,?,?,?,?,200,0)
    ON CONFLICT(cache_key) DO UPDATE SET
      request_path=excluded.request_path,
      file_path=excluded.file_path,
      content_type=excluded.content_type,
      content_length=excluded.content_length,
      etag=excluded.etag,
      last_modified=excluded.last_modified,
      fetched_at=excluded.fetched_at,
      ttl_seconds=excluded.ttl_seconds,
      sha256=excluded.sha256,
      status=200
  `).run(
    key,requestPath,path,contentType,stored.size,
    response.headers.get("etag"),response.headers.get("last-modified"),
    Math.floor(Date.now()/1000),ttl,stored.sha
  );

  audit("cache.fill",key,"success",{requestPath,size:stored.size,metadata:isMetadata});
  return entryFor(key);
}

async function handleProxy(req,res,url){
  if(!["GET","HEAD"].includes(req.method||"")) return json(res,405,{error:"GET and HEAD only"},{"allow":"GET, HEAD"});
  const requestPath=safePath(url);
  const key=cacheKey(requestPath);
  let existing=entryFor(key);

  if(isFresh(existing) && serveEntry(req,res,existing,"HIT")) return;

  try{
    const refreshed=await fetchAndCache(requestPath,key,existing);
    if(serveEntry(req,res,refreshed,existing?"REVALIDATED":"MISS")) return;
    throw new Error("CACHE_FILE_MISSING");
  }catch(error){
    existing=entryFor(key);
    if(existing && existsSync(existing.file_path)){
      audit("cache.stale",key,"success",{error:String(error?.message||error)});
      if(serveEntry(req,res,existing,"STALE")) return;
    }
    audit("cache.fetch",key,"failed",{error:String(error?.message||error)});
    const message=String(error?.message||"Upstream unavailable");
    if(message==="OBJECT_TOO_LARGE" || message==="METADATA_TOO_LARGE") return json(res,413,{error:message});
    if(message.startsWith("UPSTREAM_STATUS_")){
      const status=Number(message.slice("UPSTREAM_STATUS_".length));
      return json(res,status,{error:"Upstream returned "+status});
    }
    return json(res,502,{error:"Package upstream unavailable"});
  }
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO PACKAGE NODE",
        status:"healthy",
        upstream:ORIGIN.origin,
        publicUrl:PUBLIC_URL,
        entries:Number(db.prepare("SELECT count(*) AS count FROM cache_entries").get()?.count||0),
        cachedBytes:Number(db.prepare("SELECT coalesce(sum(content_length),0) AS total FROM cache_entries").get()?.total||0),
        thirdPartyPackageCacheRequired:false
      });
    }

    if(url.pathname.startsWith("/_izakhono/")){
      if(!authenticated(req)) return json(res,401,{error:"Unauthorized"});

      if(req.method==="GET" && url.pathname==="/_izakhono/stats"){
        return json(res,200,{
          entries:Number(db.prepare("SELECT count(*) AS count FROM cache_entries").get()?.count||0),
          bytes:Number(db.prepare("SELECT coalesce(sum(content_length),0) AS total FROM cache_entries").get()?.total||0),
          hits:Number(db.prepare("SELECT coalesce(sum(hits),0) AS total FROM cache_entries").get()?.total||0),
          recent:db.prepare("SELECT request_path,content_length,fetched_at,ttl_seconds,hits FROM cache_entries ORDER BY fetched_at DESC LIMIT 50").all()
        });
      }

      if(req.method==="POST" && url.pathname==="/_izakhono/purge"){
        const rows=db.prepare("SELECT file_path FROM cache_entries").all();
        for(const row of rows) rmSync(row.file_path,{force:true});
        db.prepare("DELETE FROM cache_entries").run();
        audit("cache.purge",null,"success",{count:rows.length});
        return json(res,200,{purged:rows.length});
      }

      return json(res,404,{error:"Not found"});
    }

    return handleProxy(req,res,url);
  }catch(error){
    const message=String(error?.message||"Unknown error");
    if(message==="INVALID_PATH") return json(res,400,{error:"Invalid package path"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO PACKAGE NODE listening on http://${HOST}:${PORT}`);
  console.log(`Upstream: ${ORIGIN.origin}`);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_PACKAGE_KEY missing; admin endpoints are disabled.");
});

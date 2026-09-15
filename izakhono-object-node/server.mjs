import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8800);
const SERVICE_KEY=process.env.IZAKHONO_OBJECT_KEY || "";
const ROOT=resolve(process.env.IZAKHONO_OBJECT_ROOT || "./objects");
const DB_PATH=resolve(process.env.IZAKHONO_OBJECT_DB || "./data/object-node.sqlite");
const TMP_ROOT=resolve(process.env.IZAKHONO_OBJECT_TMP || "./tmp");
const MAX_OBJECT=Number(process.env.IZAKHONO_OBJECT_MAX_BYTES || 1024*1024*1024);
const DEFAULT_BUCKET_QUOTA=Number(process.env.IZAKHONO_OBJECT_BUCKET_QUOTA_BYTES || 20*1024*1024*1024);

mkdirSync(ROOT,{recursive:true});
mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(TMP_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS buckets(
    name TEXT PRIMARY KEY,
    quota_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blobs(
    sha256 TEXT PRIMARY KEY,
    size_bytes INTEGER NOT NULL,
    ref_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS objects(
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    content_type TEXT,
    etag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(bucket,object_key),
    FOREIGN KEY(bucket) REFERENCES buckets(name) ON DELETE CASCADE,
    FOREIGN KEY(sha256) REFERENCES blobs(sha256)
  );

  CREATE INDEX IF NOT EXISTS objects_sha_idx ON objects(sha256);
  CREATE INDEX IF NOT EXISTS objects_bucket_updated_idx ON objects(bucket,updated_at DESC);

  CREATE TABLE IF NOT EXISTS activity_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    bucket TEXT,
    object_key TEXT,
    sha256 TEXT,
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
  return Boolean(SERVICE_KEY) && secureEqual(req.headers["x-izakhono-key"],SERVICE_KEY);
}

function validBucket(name){
  return typeof name==="string" && /^[a-z0-9][a-z0-9-]{1,62}$/.test(name);
}

function validKey(key){
  return typeof key==="string" &&
    key.length>0 &&
    key.length<=512 &&
    !key.startsWith("/") &&
    !key.includes("\\") &&
    !key.split("/").some(part=>part==="" || part==="." || part==="..") &&
    /^[A-Za-z0-9._\/-]+$/.test(key);
}

function blobPath(sha){
  const path=resolve(ROOT,sha.slice(0,2),sha.slice(2,4),sha);
  if(!path.startsWith(ROOT+sep)) throw new Error("INVALID_BLOB_PATH");
  return path;
}

function ledger(action,bucket,key,sha,outcome,detail={}){
  db.prepare(`
    INSERT INTO activity_ledger(action,bucket,object_key,sha256,outcome,detail_json)
    VALUES(?,?,?,?,?,?)
  `).run(action,bucket??null,key??null,sha??null,outcome,JSON.stringify(detail));
}

function bucketUsage(name){
  return Number(db.prepare("SELECT coalesce(sum(size_bytes),0) AS total FROM objects WHERE bucket=?").get(name)?.total||0);
}

function ensureBucket(name){
  return db.prepare("SELECT * FROM buckets WHERE name=?").get(name);
}

async function readJson(req,limit=256*1024){
  let total=0;
  const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

async function putObject(req,res,bucket,key){
  const info=ensureBucket(bucket);
  if(!info) return json(res,404,{error:"Bucket not found"});

  const declared=Number(req.headers["content-length"]||0);
  if(declared>MAX_OBJECT) return json(res,413,{error:"Object too large"});

  const tmp=resolve(TMP_ROOT,Date.now()+"-"+Math.random().toString(36).slice(2)+".part");
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

  try{
    await pipeline(req,meter,createWriteStream(tmp,{flags:"wx"}));
    const sha=hash.digest("hex");
    const etag='"sha256-'+sha+'"';
    const destination=blobPath(sha);
    mkdirSync(dirname(destination),{recursive:true});

    const existing=db.prepare("SELECT * FROM objects WHERE bucket=? AND object_key=?").get(bucket,key);
    const projected=bucketUsage(bucket) - Number(existing?.size_bytes||0) + size;
    if(projected>Number(info.quota_bytes)){
      rmSync(tmp,{force:true});
      return json(res,413,{error:"Bucket quota exceeded",quotaBytes:Number(info.quota_bytes),projectedBytes:projected});
    }

    if(!existsSync(destination)) renameSync(tmp,destination); else rmSync(tmp,{force:true});

    db.exec("BEGIN IMMEDIATE");
    try{
      db.prepare(`
        INSERT INTO blobs(sha256,size_bytes,ref_count) VALUES(?,?,0)
        ON CONFLICT(sha256) DO NOTHING
      `).run(sha,size);

      if(existing && existing.sha256!==sha){
        db.prepare("UPDATE blobs SET ref_count=ref_count-1 WHERE sha256=?").run(existing.sha256);
      }

      db.prepare(`
        INSERT INTO objects(bucket,object_key,sha256,size_bytes,content_type,etag)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(bucket,object_key) DO UPDATE SET
          sha256=excluded.sha256,
          size_bytes=excluded.size_bytes,
          content_type=excluded.content_type,
          etag=excluded.etag,
          updated_at=datetime('now')
      `).run(bucket,key,sha,size,req.headers["content-type"]||"application/octet-stream",etag);

      if(!existing || existing.sha256!==sha){
        db.prepare("UPDATE blobs SET ref_count=ref_count+1 WHERE sha256=?").run(sha);
      }

      db.exec("COMMIT");
    }catch(error){
      db.exec("ROLLBACK");
      throw error;
    }

    ledger("object.put",bucket,key,sha,"executed",{size});
    return json(res,201,{bucket,key,sha256:sha,sizeBytes:size,etag});
  }catch(error){
    rmSync(tmp,{force:true});
    if(error instanceof Error && error.message==="OBJECT_TOO_LARGE") return json(res,413,{error:"Object too large"});
    throw error;
  }
}

function getObject(req,res,bucket,key,head=false){
  const obj=db.prepare("SELECT * FROM objects WHERE bucket=? AND object_key=?").get(bucket,key);
  if(!obj) return json(res,404,{error:"Object not found"});
  const path=blobPath(obj.sha256);
  if(!existsSync(path)) return json(res,500,{error:"Blob missing"});
  const stat=statSync(path);

  res.writeHead(200,{
    "content-type":obj.content_type||"application/octet-stream",
    "content-length":stat.size,
    "etag":obj.etag,
    "cache-control":"private, max-age=0, must-revalidate",
    "x-content-type-options":"nosniff",
    "x-izakhono-object-sha256":obj.sha256
  });
  if(head) return res.end();
  createReadStream(path).pipe(res);
}

function deleteObject(res,bucket,key){
  const obj=db.prepare("SELECT * FROM objects WHERE bucket=? AND object_key=?").get(bucket,key);
  if(!obj) return json(res,404,{error:"Object not found"});

  db.exec("BEGIN IMMEDIATE");
  try{
    db.prepare("DELETE FROM objects WHERE bucket=? AND object_key=?").run(bucket,key);
    db.prepare("UPDATE blobs SET ref_count=ref_count-1 WHERE sha256=?").run(obj.sha256);
    db.exec("COMMIT");
  }catch(error){
    db.exec("ROLLBACK");
    throw error;
  }

  ledger("object.delete",bucket,key,obj.sha256,"executed",{});
  return json(res,200,{deleted:true,bucket,key});
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO OBJECT NODE",
        status:"healthy",
        buckets:Number(db.prepare("SELECT count(*) AS count FROM buckets").get()?.count||0),
        objects:Number(db.prepare("SELECT count(*) AS count FROM objects").get()?.count||0),
        thirdPartyObjectStorageRequired:false
      });
    }

    if(!authenticated(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/buckets"){
      const body=await readJson(req);
      if(!validBucket(body?.name)) return json(res,400,{error:"Invalid bucket name"});
      const quota=Math.max(1,Math.min(Number(body?.quotaBytes||DEFAULT_BUCKET_QUOTA),10*1024*1024*1024*1024));
      db.prepare("INSERT OR IGNORE INTO buckets(name,quota_bytes) VALUES(?,?)").run(body.name,quota);
      ledger("bucket.create",body.name,null,null,"executed",{quota});
      return json(res,201,{name:body.name,quotaBytes:quota});
    }

    if(req.method==="GET" && url.pathname==="/v1/buckets"){
      const buckets=db.prepare(`
        SELECT b.name,b.quota_bytes,
          coalesce((SELECT sum(o.size_bytes) FROM objects o WHERE o.bucket=b.name),0) AS used_bytes,
          coalesce((SELECT count(*) FROM objects o WHERE o.bucket=b.name),0) AS object_count
        FROM buckets b ORDER BY b.name
      `).all();
      return json(res,200,{buckets});
    }

    const list=url.pathname.match(/^\/v1\/buckets\/([^/]+)\/objects$/);
    if(req.method==="GET" && list){
      const bucket=decodeURIComponent(list[1]);
      if(!validBucket(bucket)) return json(res,400,{error:"Invalid bucket"});
      const prefix=url.searchParams.get("prefix")||"";
      const limit=Math.min(500,Math.max(1,Number(url.searchParams.get("limit")||100)));
      const rows=db.prepare(`
        SELECT object_key AS key,sha256,size_bytes AS sizeBytes,content_type AS contentType,etag,updated_at AS updatedAt
        FROM objects WHERE bucket=? AND object_key LIKE ? ORDER BY object_key LIMIT ?
      `).all(bucket,prefix+"%",limit);
      return json(res,200,{bucket,prefix,objects:rows});
    }

    const match=url.pathname.match(/^\/v1\/object\/([^/]+)\/(.+)$/);
    if(match){
      const bucket=decodeURIComponent(match[1]);
      const key=decodeURIComponent(match[2]);
      if(!validBucket(bucket) || !validKey(key)) return json(res,400,{error:"Invalid bucket or object key"});
      if(req.method==="PUT") return putObject(req,res,bucket,key);
      if(req.method==="GET") return getObject(req,res,bucket,key,false);
      if(req.method==="HEAD") return getObject(req,res,bucket,key,true);
      if(req.method==="DELETE") return deleteObject(res,bucket,key);
    }

    if(req.method==="GET" && url.pathname==="/v1/ledger"){
      return json(res,200,{entries:db.prepare("SELECT * FROM activity_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO OBJECT NODE listening on http://${HOST}:${PORT}`);
  if(!SERVICE_KEY) console.warn("WARNING: IZAKHONO_OBJECT_KEY missing; protected API will reject requests.");
});

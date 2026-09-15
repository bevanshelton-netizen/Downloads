
import { createServer } from "node:http";
import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  randomBytes, randomUUID, timingSafeEqual
} from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8860);
const DB_PATH=resolve(process.env.IZAKHONO_CODE_DB || "./data/code.sqlite");
const REPO_ROOT=resolve(process.env.IZAKHONO_CODE_REPO_ROOT || "./data/repos");
const ADMIN_KEY=process.env.IZAKHONO_CODE_ADMIN_KEY || "";
const ENCRYPTION_RAW=process.env.IZAKHONO_CODE_ENCRYPTION_KEY || "";
const WEBHOOK_ALLOWLIST=(process.env.IZAKHONO_CODE_WEBHOOK_ALLOWLIST || "127.0.0.1,localhost,::1")
  .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
const MAX_ADMIN_BODY=Math.min(2*1024*1024,Math.max(65536,Number(process.env.IZAKHONO_CODE_MAX_BODY_BYTES || 262144)));
const WEBHOOK_TIMEOUT=Math.min(30000,Math.max(1000,Number(process.env.IZAKHONO_CODE_WEBHOOK_TIMEOUT_MS || 5000)));

function encryptionKey(){
  const key=Buffer.from(ENCRYPTION_RAW,"base64");
  if(key.length!==32) throw new Error("IZAKHONO_CODE_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
encryptionKey();

const gitExecPath=execFileSync("git",["--exec-path"],{encoding:"utf8"}).trim();
const HTTP_BACKEND=join(gitExecPath,process.platform==="win32"?"git-http-backend.exe":"git-http-backend");
if(!existsSync(HTTP_BACKEND)) throw new Error("git-http-backend was not found under git --exec-path");

mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(REPO_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec([
  "PRAGMA journal_mode=WAL;",
  "PRAGMA synchronous=NORMAL;",
  "PRAGMA foreign_keys=ON;",
  "PRAGMA busy_timeout=5000;",
  "CREATE TABLE IF NOT EXISTS repositories(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,description TEXT,public_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  "CREATE TABLE IF NOT EXISTS repo_tokens(id TEXT PRIMARY KEY,repository_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,prefix TEXT NOT NULL,label TEXT,scope TEXT NOT NULL CHECK(scope IN ('read','write')),expires_at TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),last_used_at TEXT,revoked_at TEXT,FOREIGN KEY(repository_id) REFERENCES repositories(id) ON DELETE CASCADE);",
  "CREATE INDEX IF NOT EXISTS repo_tokens_lookup_idx ON repo_tokens(token_hash,revoked_at);",
  "CREATE TABLE IF NOT EXISTS webhooks(id TEXT PRIMARY KEY,repository_id TEXT NOT NULL,url TEXT NOT NULL,secret_encrypted TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,failure_count INTEGER NOT NULL DEFAULT 0,last_status INTEGER,last_error TEXT,last_delivered_at TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY(repository_id) REFERENCES repositories(id) ON DELETE CASCADE);",
  "CREATE TABLE IF NOT EXISTS audit_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,occurred_at TEXT NOT NULL DEFAULT (datetime('now')),action TEXT NOT NULL,repository_id TEXT,actor TEXT,outcome TEXT NOT NULL,detail_json TEXT NOT NULL DEFAULT '{}',FOREIGN KEY(repository_id) REFERENCES repositories(id) ON DELETE SET NULL);",
  "CREATE INDEX IF NOT EXISTS audit_repo_time_idx ON audit_ledger(repository_id,occurred_at DESC);"
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

function safeEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}
function sha256(v){return createHash("sha256").update(v).digest("hex");}
function admin(req){return Boolean(ADMIN_KEY)&&safeEqual(req.headers["x-izakhono-key"],ADMIN_KEY);}

function encrypt(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const ct=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:tag.toString("base64"),ct:ct.toString("base64")});
}
function decrypt(value){
  const e=JSON.parse(value);
  if(e.v!==1) throw new Error("UNSUPPORTED_SECRET_ENVELOPE");
  const d=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(e.iv,"base64"));
  d.setAuthTag(Buffer.from(e.tag,"base64"));
  return Buffer.concat([d.update(Buffer.from(e.ct,"base64")),d.final()]).toString("utf8");
}

async function readJson(req,limit=MAX_ADMIN_BODY){
  let total=0;
  const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

function validSlug(v){
  return typeof v==="string" &&
    /^[a-z0-9][a-z0-9._-]{1,79}$/.test(v) &&
    !v.endsWith(".git") && v!=="." && v!=="..";
}
function repoPath(slug){return join(REPO_ROOT,slug+".git");}
function repoBySlug(slug){return db.prepare("SELECT * FROM repositories WHERE slug=?").get(slug) || null;}

function audit(action,repositoryId,actor,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,repository_id,actor,outcome,detail_json) VALUES(?,?,?,?,?)")
    .run(action,repositoryId??null,actor??null,outcome,JSON.stringify(detail));
}

function runGit(args,cwd){
  return execFileSync("git",args,{
    cwd,
    encoding:"utf8",
    stdio:["ignore","pipe","pipe"],
    maxBuffer:10*1024*1024
  }).trim();
}

function listRefs(repo){
  const out=runGit(["for-each-ref","--format=%(refname)%09%(objectname)"],repoPath(repo.slug));
  const map={};
  if(!out) return map;
  for(const line of out.split("\n")){
    const parts=line.split("\t");
    if(parts[0] && parts[1]) map[parts[0]]=parts[1];
  }
  return map;
}

function diffRefs(before,after){
  const refs=new Set([...Object.keys(before),...Object.keys(after)]);
  const changes=[];
  for(const ref of refs){
    const oldOid=before[ref]||null;
    const newOid=after[ref]||null;
    if(oldOid!==newOid) changes.push({ref,oldOid,newOid});
  }
  return changes;
}

function extractToken(req){
  const auth=String(req.headers.authorization||"");
  if(auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if(auth.startsWith("Basic ")){
    try{
      const decoded=Buffer.from(auth.slice(6).trim(),"base64").toString("utf8");
      const colon=decoded.indexOf(":");
      return colon>=0?decoded.slice(colon+1):"";
    }catch{return "";}
  }
  return String(req.headers["x-api-key"]||"");
}

function tokenAccess(req,repo,requiredScope){
  if(requiredScope==="read" && repo.public_read) return {ok:true,actor:"public"};
  const raw=extractToken(req);
  if(!raw) return {ok:false};
  const row=db.prepare("SELECT * FROM repo_tokens WHERE repository_id=? AND token_hash=? AND revoked_at IS NULL AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))")
    .get(repo.id,sha256(raw));
  if(!row) return {ok:false};
  if(requiredScope==="write" && row.scope!=="write") return {ok:false};
  db.prepare("UPDATE repo_tokens SET last_used_at=datetime('now') WHERE id=?").run(row.id);
  return {ok:true,actor:"token:"+row.prefix,token:row};
}

function webhookUrl(value){
  let u;
  try{u=new URL(value);}catch{throw new Error("INVALID_WEBHOOK_URL");}
  if(u.username || u.password || u.hash) throw new Error("INVALID_WEBHOOK_URL");
  const host=u.hostname.toLowerCase();
  if(!WEBHOOK_ALLOWLIST.includes(host)) throw new Error("WEBHOOK_HOST_NOT_ALLOWED");
  const local=["127.0.0.1","localhost","::1"].includes(host);
  if(!local && u.protocol!=="https:") throw new Error("EXTERNAL_WEBHOOK_REQUIRES_HTTPS");
  if(local && !["http:","https:"].includes(u.protocol)) throw new Error("INVALID_WEBHOOK_URL");
  return u.toString();
}

async function dispatchPush(repo,changes){
  if(!changes.length) return;
  const rows=db.prepare("SELECT * FROM webhooks WHERE repository_id=? AND enabled=1 ORDER BY created_at").all(repo.id);
  const payload=JSON.stringify({
    event:"push",
    repository:{id:repo.id,slug:repo.slug},
    changes,
    occurredAt:new Date().toISOString()
  });
  for(const hook of rows){
    const secret=decrypt(hook.secret_encrypted);
    const signature="sha256="+createHmac("sha256",secret).update(payload).digest("hex");
    try{
      const response=await fetch(hook.url,{
        method:"POST",
        headers:{
          "content-type":"application/json",
          "x-izakhono-event":"push",
          "x-izakhono-signature":signature
        },
        body:payload,
        signal:AbortSignal.timeout(WEBHOOK_TIMEOUT)
      });
      db.prepare("UPDATE webhooks SET failure_count=?,last_status=?,last_error=NULL,last_delivered_at=datetime('now'),updated_at=datetime('now') WHERE id=?")
        .run(response.ok?0:Number(hook.failure_count||0)+1,response.status,hook.id);
      audit("webhook.deliver",repo.id,"system",response.ok?"success":"failed",{webhookId:hook.id,status:response.status});
    }catch(error){
      db.prepare("UPDATE webhooks SET failure_count=failure_count+1,last_error=?,updated_at=datetime('now') WHERE id=?")
        .run(String(error?.message||"WEBHOOK_FAILED").slice(0,1000),hook.id);
      audit("webhook.deliver",repo.id,"system","failed",{webhookId:hook.id,error:String(error?.message||"WEBHOOK_FAILED")});
    }
  }
}

function serviceFor(url,suffix){
  if(suffix==="/git-upload-pack") return "git-upload-pack";
  if(suffix==="/git-receive-pack") return "git-receive-pack";
  if(suffix==="/info/refs"){
    const s=url.searchParams.get("service");
    if(s==="git-upload-pack" || s==="git-receive-pack") return s;
  }
  return null;
}

function writeCgiHeaders(res,raw){
  const text=raw.toString("utf8").replace(/\r\n/g,"\n");
  const headers={};
  let status=200;
  for(const line of text.split("\n")){
    if(!line) continue;
    const i=line.indexOf(":");
    if(i<1) continue;
    const key=line.slice(0,i).trim();
    const value=line.slice(i+1).trim();
    if(key.toLowerCase()==="status"){
      status=Number(value.split(/\s+/)[0])||200;
    }else{
      headers[key]=value;
    }
  }
  res.writeHead(status,headers);
}

async function serveGit(req,res,url,repo,suffix){
  const service=serviceFor(url,suffix);
  if(!service) return json(res,404,{error:"Unsupported Git endpoint"});
  const required=service==="git-receive-pack"?"write":"read";
  const auth=tokenAccess(req,repo,required);
  if(!auth.ok){
    res.writeHead(401,{"www-authenticate":'Basic realm="IZAKHONO CODE"',"cache-control":"no-store"});
    res.end("Authentication required");
    return;
  }

  const before=required==="write"?listRefs(repo):null;
  const child=spawn(HTTP_BACKEND,[],{
    env:{
      ...process.env,
      GIT_PROJECT_ROOT:REPO_ROOT,
      GIT_HTTP_EXPORT_ALL:"1",
      PATH_INFO:"/"+repo.slug+".git"+suffix,
      QUERY_STRING:url.searchParams.toString(),
      REQUEST_METHOD:req.method,
      CONTENT_TYPE:String(req.headers["content-type"]||""),
      CONTENT_LENGTH:String(req.headers["content-length"]||""),
      REMOTE_USER:auth.actor,
      REMOTE_ADDR:req.socket.remoteAddress||"",
      SERVER_PROTOCOL:"HTTP/1.1",
      SCRIPT_NAME:"/git"
    },
    stdio:["pipe","pipe","pipe"]
  });

  let headerBuffer=Buffer.alloc(0);
  let headersSent=false;
  let stderr="";
  let backendFailed=false;

  child.on("error",error=>{
    backendFailed=true;
    if(!res.headersSent) json(res,502,{error:"Git backend failed"});
    else if(!res.writableEnded) res.end();
    audit("git.backend",repo.id,auth.actor,"failed",{service,error:String(error.message||error)});
  });

  child.stderr.on("data",chunk=>{
    if(stderr.length<4000) stderr+=chunk.toString("utf8");
  });

  child.stdout.on("data",chunk=>{
    if(headersSent){
      res.write(chunk);
      return;
    }
    headerBuffer=Buffer.concat([headerBuffer,chunk]);
    let idx=headerBuffer.indexOf("\r\n\r\n");
    let delimiter=4;
    if(idx<0){
      idx=headerBuffer.indexOf("\n\n");
      delimiter=2;
    }
    if(idx<0){
      if(headerBuffer.length>64*1024){
        backendFailed=true;
        child.kill("SIGKILL");
        if(!res.headersSent) json(res,502,{error:"Invalid Git backend response"});
      }
      return;
    }
    writeCgiHeaders(res,headerBuffer.subarray(0,idx));
    headersSent=true;
    const rest=headerBuffer.subarray(idx+delimiter);
    if(rest.length) res.write(rest);
    headerBuffer=Buffer.alloc(0);
  });

  req.pipe(child.stdin);

  child.on("close",async code=>{
    if(!headersSent && !res.headersSent){
      backendFailed=true;
      json(res,502,{error:"Git backend returned no response",detail:stderr.slice(0,500)});
    }else if(!res.writableEnded){
      res.end();
    }

    if(code!==0){
      backendFailed=true;
      audit("git."+required,repo.id,auth.actor,"failed",{service,code,stderr:stderr.slice(0,500)});
      return;
    }

    audit("git."+required,repo.id,auth.actor,"success",{service});
    if(required==="write" && !backendFailed){
      try{
        const after=listRefs(repo);
        const changes=diffRefs(before,after);
        if(changes.length){
          audit("repo.refs.update",repo.id,auth.actor,"success",{changes});
          await dispatchPush(repo,changes);
        }
      }catch(error){
        audit("repo.refs.update",repo.id,auth.actor,"failed",{error:String(error?.message||error)});
      }
    }
  });
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO CODE NODE",
        status:"healthy",
        repositories:Number(db.prepare("SELECT count(*) AS count FROM repositories").get()?.count||0),
        gitSmartHttp:true,
        thirdPartyCodeHostRequired:false
      });
    }

    const gitMatch=url.pathname.match(/^\/git\/([a-z0-9][a-z0-9._-]{1,79})\.git(\/info\/refs|\/git-upload-pack|\/git-receive-pack)$/);
    if(gitMatch){
      const repository=repoBySlug(gitMatch[1]);
      if(!repository) return json(res,404,{error:"Repository not found"});
      return serveGit(req,res,url,repository,gitMatch[2]);
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/repos"){
      const body=await readJson(req);
      const slug=String(body?.slug||"").trim().toLowerCase();
      if(!validSlug(slug)) return json(res,400,{error:"Invalid repository slug"});
      if(repoBySlug(slug)) return json(res,409,{error:"Repository already exists"});

      const path=repoPath(slug);
      mkdirSync(REPO_ROOT,{recursive:true});
      runGit(["init","--bare","--initial-branch=main",path],REPO_ROOT);
      runGit(["config","http.receivepack","true"],path);

      const id=randomUUID();
      db.prepare("INSERT INTO repositories(id,slug,description,public_read) VALUES(?,?,?,?)")
        .run(id,slug,String(body?.description||"").slice(0,1000),body?.publicRead?1:0);
      audit("repo.create",id,"admin","success",{slug,publicRead:Boolean(body?.publicRead)});
      return json(res,201,{repository:{id,slug,description:String(body?.description||""),publicRead:Boolean(body?.publicRead)}});
    }

    if(req.method==="GET" && url.pathname==="/v1/repos"){
      const rows=db.prepare("SELECT id,slug,description,public_read,created_at,updated_at FROM repositories ORDER BY slug").all()
        .map(r=>({id:r.id,slug:r.slug,description:r.description,publicRead:Boolean(r.public_read),createdAt:r.created_at,updatedAt:r.updated_at}));
      return json(res,200,{repositories:rows});
    }

    const tokenMatch=url.pathname.match(/^\/v1\/repos\/([^/]+)\/tokens$/);
    if(req.method==="POST" && tokenMatch){
      const repository=repoBySlug(decodeURIComponent(tokenMatch[1]));
      if(!repository) return json(res,404,{error:"Repository not found"});
      const body=await readJson(req);
      const scope=body?.scope==="read"?"read":body?.scope==="write"?"write":null;
      if(!scope) return json(res,400,{error:"Scope must be read or write"});
      const raw="izc_"+randomBytes(32).toString("base64url");
      const id=randomUUID();
      let expiresAt=null;
      if(body?.expiresAt){
        const d=new Date(body.expiresAt);
        if(Number.isNaN(d.getTime()) || d.getTime()<=Date.now()) return json(res,400,{error:"Invalid expiresAt"});
        expiresAt=d.toISOString();
      }
      db.prepare("INSERT INTO repo_tokens(id,repository_id,token_hash,prefix,label,scope,expires_at) VALUES(?,?,?,?,?,?,?)")
        .run(id,repository.id,sha256(raw),raw.slice(0,12),String(body?.label||"").slice(0,120),scope,expiresAt);
      audit("token.create",repository.id,"admin","success",{tokenId:id,scope,label:String(body?.label||"")});
      return json(res,201,{token:{id,prefix:raw.slice(0,12),scope,expiresAt},value:raw});
    }

    const revokeMatch=url.pathname.match(/^\/v1\/repos\/([^/]+)\/tokens\/([^/]+)\/revoke$/);
    if(req.method==="POST" && revokeMatch){
      const repository=repoBySlug(decodeURIComponent(revokeMatch[1]));
      if(!repository) return json(res,404,{error:"Repository not found"});
      const result=db.prepare("UPDATE repo_tokens SET revoked_at=datetime('now') WHERE id=? AND repository_id=? AND revoked_at IS NULL")
        .run(revokeMatch[2],repository.id);
      audit("token.revoke",repository.id,"admin",Number(result.changes||0)?"success":"failed",{tokenId:revokeMatch[2]});
      return json(res,Number(result.changes||0)?200:404,{revoked:Number(result.changes||0)>0});
    }

    const refsMatch=url.pathname.match(/^\/v1\/repos\/([^/]+)\/refs$/);
    if(req.method==="GET" && refsMatch){
      const repository=repoBySlug(decodeURIComponent(refsMatch[1]));
      if(!repository) return json(res,404,{error:"Repository not found"});
      const refs=listRefs(repository);
      return json(res,200,{repository:repository.slug,refs:Object.entries(refs).map(([ref,oid])=>({ref,oid}))});
    }

    const commitsMatch=url.pathname.match(/^\/v1\/repos\/([^/]+)\/commits$/);
    if(req.method==="GET" && commitsMatch){
      const repository=repoBySlug(decodeURIComponent(commitsMatch[1]));
      if(!repository) return json(res,404,{error:"Repository not found"});
      const ref=url.searchParams.get("ref")||"HEAD";
      if(!/^[A-Za-z0-9._\/-]{1,200}$/.test(ref) || ref.includes("..")) return json(res,400,{error:"Invalid ref"});
      const limit=Math.min(200,Math.max(1,Number(url.searchParams.get("limit")||50)));
      let out="";
      try{
        out=runGit(["log","-"+limit,"--format=%H%x09%P%x09%an%x09%ae%x09%aI%x09%s",ref],repoPath(repository.slug));
      }catch{
        return json(res,200,{repository:repository.slug,ref,commits:[]});
      }
      const commits=out?out.split("\n").map(line=>{
        const parts=line.split("\t");
        return {
          sha:parts[0],
          parents:parts[1]?parts[1].split(" "):[],
          author:parts[2],
          email:parts[3],
          date:parts[4],
          subject:parts.slice(5).join("\t")
        };
      }):[];
      return json(res,200,{repository:repository.slug,ref,commits});
    }

    const hookMatch=url.pathname.match(/^\/v1\/repos\/([^/]+)\/webhooks$/);
    if(req.method==="POST" && hookMatch){
      const repository=repoBySlug(decodeURIComponent(hookMatch[1]));
      if(!repository) return json(res,404,{error:"Repository not found"});
      const body=await readJson(req);
      const target=webhookUrl(body?.url);
      const secret="izcwh_"+randomBytes(32).toString("base64url");
      const id=randomUUID();
      db.prepare("INSERT INTO webhooks(id,repository_id,url,secret_encrypted) VALUES(?,?,?,?)")
        .run(id,repository.id,target,encrypt(secret));
      audit("webhook.create",repository.id,"admin","success",{webhookId:id,url:target});
      return json(res,201,{webhook:{id,url:target,event:"push"},secret});
    }

    if(req.method==="GET" && hookMatch){
      const repository=repoBySlug(decodeURIComponent(hookMatch[1]));
      if(!repository) return json(res,404,{error:"Repository not found"});
      const hooks=db.prepare("SELECT id,url,enabled,failure_count,last_status,last_error,last_delivered_at,created_at,updated_at FROM webhooks WHERE repository_id=? ORDER BY created_at")
        .all(repository.id);
      return json(res,200,{repository:repository.slug,webhooks:hooks});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      const limit=Math.min(1000,Math.max(1,Number(url.searchParams.get("limit")||100)));
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT ?").all(limit)});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(["INVALID_WEBHOOK_URL","WEBHOOK_HOST_NOT_ALLOWED","EXTERNAL_WEBHOOK_REQUIRES_HTTPS"].includes(message)){
      return json(res,400,{error:message});
    }
    if(String(message).includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log("IZAKHONO CODE NODE listening on http://"+HOST+":"+PORT);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_CODE_ADMIN_KEY missing; admin API will reject requests.");
});

import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createWitnessLeaseGuard, isWriteMethod } from "./witness-lease.mjs";

const CONTROL_HOST=process.env.CONTROL_HOST || "127.0.0.1";
const CONTROL_PORT=Number(process.env.CONTROL_PORT || 8790);
const PROXY_HOST=process.env.PROXY_HOST || "0.0.0.0";
const PROXY_PORT=Number(process.env.PROXY_PORT || 8080);
const SERVICE_KEY=process.env.IZAKHONO_RUNTIME_KEY || "";
const RELEASE_ROOT=resolve(process.env.IZAKHONO_RELEASE_ROOT || "./releases");
const DB_PATH=resolve(process.env.IZAKHONO_RUNTIME_DB || "./data/runtime.sqlite");
const LOG_ROOT=resolve(process.env.IZAKHONO_RUNTIME_LOG_ROOT || "./logs");
const ENV_ROOT=resolve(process.env.IZAKHONO_ENV_ROOT || "./env");
const START_PORT=Number(process.env.IZAKHONO_APP_PORT_START || 12000);
const witness=createWitnessLeaseGuard("runtime");
witness.start();

mkdirSync(RELEASE_ROOT,{recursive:true});
mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(LOG_ROOT,{recursive:true});
mkdirSync(ENV_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS apps(
    name TEXT PRIMARY KEY,
    hostname TEXT NOT NULL UNIQUE,
    active_deployment_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_aliases(
    hostname TEXT PRIMARY KEY,
    app_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(app_name) REFERENCES apps(name) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS app_aliases_app_idx
    ON app_aliases(app_name);

  CREATE TABLE IF NOT EXISTS deployments(
    id TEXT PRIMARY KEY,
    app_name TEXT NOT NULL,
    release_path TEXT NOT NULL,
    command_json TEXT NOT NULL,
    env_file TEXT,
    health_path TEXT NOT NULL DEFAULT '/',
    port INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('starting','active','previous','failed','stopped')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    activated_at TEXT,
    stopped_at TEXT,
    FOREIGN KEY(app_name) REFERENCES apps(name)
  );

  CREATE INDEX IF NOT EXISTS deployments_app_idx
    ON deployments(app_name, created_at DESC);

  CREATE TABLE IF NOT EXISTS activity_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    app_name TEXT,
    deployment_id TEXT,
    outcome TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );
`);

const processes=new Map();

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

function secureEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}

function authenticated(req){
  return Boolean(SERVICE_KEY) && secureEqual(req.headers["x-izakhono-key"],SERVICE_KEY);
}

async function readBody(req,limit=1024*1024){
  let total=0;
  const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  if(chunks.length===0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function safeName(value){
  if(typeof value!=="string" || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(value)) throw new Error("INVALID_APP_NAME");
  return value;
}

function safeHostname(value){
  if(typeof value!=="string" || !/^[a-z0-9.-]+$/i.test(value) || !value.includes(".")) throw new Error("INVALID_HOSTNAME");
  return value.toLowerCase();
}

function inside(root,path){
  const normalized=resolve(path);
  return normalized===root || normalized.startsWith(root+sep);
}

function safeReleasePath(value){
  if(typeof value!=="string") throw new Error("INVALID_RELEASE_PATH");
  const path=resolve(value);
  if(!inside(RELEASE_ROOT,path)) throw new Error("RELEASE_OUTSIDE_ROOT");
  if(!existsSync(path)) throw new Error("RELEASE_NOT_FOUND");
  return path;
}

function safeEnvFile(value){
  if(value==null || value==="") return null;
  if(typeof value!=="string") throw new Error("INVALID_ENV_FILE");
  const path=resolve(value);
  if(!inside(ENV_ROOT,path)) throw new Error("ENV_OUTSIDE_ROOT");
  if(!existsSync(path)) throw new Error("ENV_FILE_NOT_FOUND");
  return path;
}

function parseEnvFile(path){
  if(!path) return {};
  const result={};
  for(const raw of readFileSync(path,"utf8").split(/\r?\n/)){
    const line=raw.trim();
    if(!line || line.startsWith("#")) continue;
    const idx=line.indexOf("=");
    if(idx<1) continue;
    const key=line.slice(0,idx).trim();
    const value=line.slice(idx+1);
    if(/^[A-Z_][A-Z0-9_]*$/i.test(key)) result[key]=value;
  }
  return result;
}

function safeCommand(value){
  if(!Array.isArray(value) || value.length===0 || value.some(x=>typeof x!=="string")) throw new Error("INVALID_COMMAND");
  if(!["node","npm"].includes(value[0])) throw new Error("COMMAND_NOT_ALLOWED");
  if(value.length>12) throw new Error("COMMAND_TOO_LONG");
  return value;
}

function allocatePort(){
  const used=new Set(db.prepare("SELECT port FROM deployments WHERE state IN ('starting','active')").all().map(x=>Number(x.port)));
  for(let port=START_PORT;port<START_PORT+3000;port++){
    if(!used.has(port)) return port;
  }
  throw new Error("NO_APP_PORT_AVAILABLE");
}

function ledger(action,app,deployment,outcome,detail={}){
  db.prepare(`
    INSERT INTO activity_ledger(action,app_name,deployment_id,outcome,detail_json)
    VALUES(?,?,?,?,?)
  `).run(action,app??null,deployment??null,outcome,JSON.stringify(detail));
}

function stopProcess(id){
  const child=processes.get(id);
  if(child){
    child.kill("SIGTERM");
    processes.delete(id);
  }
}

function wait(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

async function waitHealthy(port,path,timeoutMs=15000){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    try{
      const response=await fetch(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(1500)});
      if(response.ok) return true;
    }catch{}
    await wait(250);
  }
  return false;
}

function spawnDeployment({id,appName,releasePath,command,envFile,port}){
  const logDir=resolve(LOG_ROOT,appName);
  mkdirSync(logDir,{recursive:true});
  const log=createWriteStream(resolve(logDir,`${id}.log`),{flags:"a"});
  const [exe,...args]=command;
  const child=spawn(exe,args,{
    cwd:releasePath,
    env:{
      ...process.env,
      ...parseEnvFile(envFile),
      PORT:String(port),
      HOST:"127.0.0.1",
      IZAKHONO_DEPLOYMENT_ID:id,
      IZAKHONO_APP_NAME:appName
    },
    stdio:["ignore","pipe","pipe"]
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit",(code,signal)=>{
    processes.delete(id);
    const row=db.prepare("SELECT state FROM deployments WHERE id=?").get(id);
    if(row && row.state==="active"){
      db.prepare("UPDATE deployments SET state='failed',stopped_at=datetime('now') WHERE id=?").run(id);
      ledger("process.exit",appName,id,"failed",{code,signal});
    }
  });
  processes.set(id,child);
  return child;
}

async function activateDeployment(input,{rollback=false}={}){
  const appName=safeName(input.app);
  const hostname=safeHostname(input.hostname);
  const releasePath=safeReleasePath(input.releasePath);
  const command=safeCommand(input.command);
  const envFile=safeEnvFile(input.envFile);
  const healthPath=typeof input.healthPath==="string" && input.healthPath.startsWith("/") ? input.healthPath : "/";
  const id=randomUUID();
  const port=allocatePort();

  db.exec("BEGIN IMMEDIATE");
  try{
    db.prepare(`
      INSERT INTO apps(name,hostname) VALUES(?,?)
      ON CONFLICT(name) DO UPDATE SET hostname=excluded.hostname,updated_at=datetime('now')
    `).run(appName,hostname);
    db.prepare(`
      INSERT INTO deployments(id,app_name,release_path,command_json,env_file,health_path,port,state)
      VALUES(?,?,?,?,?,?,?,'starting')
    `).run(id,appName,releasePath,JSON.stringify(command),envFile,healthPath,port);
    db.exec("COMMIT");
  }catch(error){
    db.exec("ROLLBACK");
    throw error;
  }

  ledger(rollback?"rollback.start":"deployment.start",appName,id,"proposed",{releasePath,port});
  spawnDeployment({id,appName,releasePath,command,envFile,port});
  const healthy=await waitHealthy(port,healthPath);

  if(!healthy){
    stopProcess(id);
    db.prepare("UPDATE deployments SET state='failed',stopped_at=datetime('now') WHERE id=?").run(id);
    ledger(rollback?"rollback.health":"deployment.health",appName,id,"failed",{port,healthPath});
    throw new Error("HEALTH_CHECK_FAILED");
  }

  const previous=db.prepare("SELECT active_deployment_id FROM apps WHERE name=?").get(appName)?.active_deployment_id||null;

  db.exec("BEGIN IMMEDIATE");
  try{
    if(previous){
      db.prepare("UPDATE deployments SET state='previous',stopped_at=datetime('now') WHERE id=?").run(previous);
    }
    db.prepare("UPDATE deployments SET state='active',activated_at=datetime('now') WHERE id=?").run(id);
    db.prepare("UPDATE apps SET active_deployment_id=?,hostname=?,updated_at=datetime('now') WHERE name=?").run(id,hostname,appName);
    db.exec("COMMIT");
  }catch(error){
    db.exec("ROLLBACK");
    stopProcess(id);
    throw error;
  }

  if(previous) stopProcess(previous);
  ledger(rollback?"rollback.activate":"deployment.activate",appName,id,"executed",{previous,port});
  return {id,app:appName,hostname,port,previous,releasePath};
}

async function rollbackApp(appName){
  safeName(appName);
  const app=db.prepare("SELECT * FROM apps WHERE name=?").get(appName);
  if(!app?.active_deployment_id) throw new Error("NO_ACTIVE_DEPLOYMENT");
  const current=db.prepare("SELECT * FROM deployments WHERE id=?").get(app.active_deployment_id);
  const previous=db.prepare(`
    SELECT * FROM deployments
    WHERE app_name=? AND id<>? AND state IN ('previous','stopped')
    ORDER BY COALESCE(activated_at,created_at) DESC LIMIT 1
  `).get(appName,current.id);
  if(!previous) throw new Error("NO_PREVIOUS_DEPLOYMENT");

  return activateDeployment({
    app:appName,
    hostname:app.hostname,
    releasePath:previous.release_path,
    command:JSON.parse(previous.command_json),
    envFile:previous.env_file,
    healthPath:previous.health_path
  },{rollback:true});
}

function activeRoute(hostname){
  const canonical=db.prepare(`
    SELECT a.name,a.hostname,d.id AS deployment_id,d.port
    FROM apps a JOIN deployments d ON d.id=a.active_deployment_id
    WHERE a.hostname=? AND d.state='active'
  `).get(hostname);
  if(canonical) return canonical;
  return db.prepare(`
    SELECT a.name,x.hostname,d.id AS deployment_id,d.port
    FROM app_aliases x
    JOIN apps a ON a.name=x.app_name
    JOIN deployments d ON d.id=a.active_deployment_id
    WHERE x.hostname=? AND d.state='active'
  `).get(hostname);
}

function addAlias(appName,hostname){
  safeName(appName);
  const alias=safeHostname(hostname);
  const app=db.prepare("SELECT name,hostname FROM apps WHERE name=?").get(appName);
  if(!app) throw new Error("APP_NOT_FOUND");
  if(app.hostname===alias) return {app:appName,hostname:alias,canonical:true};
  const canonicalConflict=db.prepare("SELECT name FROM apps WHERE hostname=?").get(alias);
  if(canonicalConflict) throw new Error("HOSTNAME_IN_USE");
  db.prepare(`
    INSERT INTO app_aliases(hostname,app_name) VALUES(?,?)
    ON CONFLICT(hostname) DO UPDATE SET app_name=excluded.app_name
  `).run(alias,appName);
  ledger("app.alias.add",appName,null,"executed",{hostname:alias});
  return {app:appName,hostname:alias,canonical:false};
}

const control=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO RUNTIME NODE",
        status:"healthy",
        proxyPort:PROXY_PORT,
        apps:Number(db.prepare("SELECT count(*) AS count FROM apps").get()?.count||0),
        active:Number(db.prepare("SELECT count(*) AS count FROM deployments WHERE state='active'").get()?.count||0),
        thirdPartyRuntimeRequired:false,
        witness:witness.snapshot()
      });
    }

    if(!authenticated(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="GET" && url.pathname==="/v1/apps"){
      const apps=db.prepare(`
        SELECT a.*,d.release_path,d.port,d.state,d.activated_at
        FROM apps a LEFT JOIN deployments d ON d.id=a.active_deployment_id
        ORDER BY a.name
      `).all();
      for(const app of apps){
        app.aliases=db.prepare("SELECT hostname FROM app_aliases WHERE app_name=? ORDER BY hostname").all(app.name).map(x=>x.hostname);
      }
      return json(res,200,{apps});
    }

    const aliasAdd=url.pathname.match(/^\/v1\/apps\/([^/]+)\/aliases$/);
    if(req.method==="POST" && aliasAdd){
      const body=await readBody(req);
      const result=addAlias(aliasAdd[1],body?.hostname);
      return json(res,201,result);
    }

    const aliasDelete=url.pathname.match(/^\/v1\/apps\/([^/]+)\/aliases\/([^/]+)$/);
    if(req.method==="DELETE" && aliasDelete){
      const app=safeName(aliasDelete[1]);
      const hostname=safeHostname(decodeURIComponent(aliasDelete[2]));
      const result=db.prepare("DELETE FROM app_aliases WHERE app_name=? AND hostname=?").run(app,hostname);
      ledger("app.alias.remove",app,null,"executed",{hostname,changes:Number(result.changes||0)});
      return json(res,200,{app,hostname,removed:Number(result.changes||0)>0});
    }

    if(req.method==="POST" && url.pathname==="/v1/deployments"){
      const body=await readBody(req);
      const result=await activateDeployment(body||{});
      return json(res,201,result);
    }

    const rollback=url.pathname.match(/^\/v1\/apps\/([^/]+)\/rollback$/);
    if(req.method==="POST" && rollback){
      const result=await rollbackApp(rollback[1]);
      return json(res,200,result);
    }

    const stop=url.pathname.match(/^\/v1\/apps\/([^/]+)\/stop$/);
    if(req.method==="POST" && stop){
      const app=safeName(stop[1]);
      const active=db.prepare("SELECT active_deployment_id FROM apps WHERE name=?").get(app)?.active_deployment_id;
      if(!active) return json(res,404,{error:"No active deployment"});
      stopProcess(active);
      db.prepare("UPDATE deployments SET state='stopped',stopped_at=datetime('now') WHERE id=?").run(active);
      db.prepare("UPDATE apps SET active_deployment_id=NULL,updated_at=datetime('now') WHERE name=?").run(app);
      ledger("app.stop",app,active,"executed",{});
      return json(res,200,{app,stopped:true});
    }

    if(req.method==="GET" && url.pathname==="/v1/ledger"){
      return json(res,200,{entries:db.prepare("SELECT * FROM activity_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    const clientErrors=new Set([
      "BODY_TOO_LARGE","INVALID_APP_NAME","INVALID_HOSTNAME","INVALID_RELEASE_PATH",
      "RELEASE_OUTSIDE_ROOT","RELEASE_NOT_FOUND","INVALID_ENV_FILE","ENV_OUTSIDE_ROOT",
      "ENV_FILE_NOT_FOUND","INVALID_COMMAND","COMMAND_NOT_ALLOWED","COMMAND_TOO_LONG",
      "NO_ACTIVE_DEPLOYMENT","NO_PREVIOUS_DEPLOYMENT","APP_NOT_FOUND","HOSTNAME_IN_USE"
    ]);
    if(message==="HEALTH_CHECK_FAILED") return json(res,422,{error:message});
    if(clientErrors.has(message)) return json(res,400,{error:message});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

const proxy=createServer((req,res)=>{
  const rawHost=(req.headers.host||"").split(":")[0].toLowerCase();
  if(isWriteMethod(req.method) && !witness.canWrite()){
    witness.applyResponseHeaders(res);
    res.writeHead(503,{"content-type":"text/plain; charset=utf-8","retry-after":"5"});
    ledger("witness.write.block",rawHost||null,null,"blocked",witness.snapshot());
    return res.end("IZAKHONO RUNTIME: write blocked because witness leadership lease is not valid");
  }
  const route=activeRoute(rawHost);
  if(!route){
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});
    return res.end("IZAKHONO RUNTIME NODE: route not found");
  }

  const upstream=httpRequest({
    hostname:"127.0.0.1",
    port:Number(route.port),
    method:req.method,
    path:req.url,
    headers:{...req.headers,...witness.requestHeaders(),host:rawHost,"x-izakhono-app":route.name}
  },upstreamRes=>{
    for(const [name,value] of Object.entries(upstreamRes.headers)){
      if(value!==undefined) res.setHeader(name,value);
    }
    witness.applyResponseHeaders(res);
    res.writeHead(upstreamRes.statusCode||502);
    upstreamRes.pipe(res);
  });

  upstream.on("error",()=>{
    if(!res.headersSent) res.writeHead(502,{"content-type":"text/plain; charset=utf-8"});
    res.end("IZAKHONO RUNTIME NODE: upstream unavailable");
  });
  req.pipe(upstream);
});

control.listen(CONTROL_PORT,CONTROL_HOST,()=>{
  console.log(`IZAKHONO RUNTIME control: http://${CONTROL_HOST}:${CONTROL_PORT}`);
  if(!SERVICE_KEY) console.warn("WARNING: IZAKHONO_RUNTIME_KEY missing; protected control API will reject requests.");
});

proxy.listen(PROXY_PORT,PROXY_HOST,()=>{
  console.log(`IZAKHONO RUNTIME proxy: http://${PROXY_HOST}:${PROXY_PORT}`);
});

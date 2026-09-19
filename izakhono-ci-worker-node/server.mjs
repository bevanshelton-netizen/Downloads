
import { createServer } from "node:http";
import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  randomBytes, randomUUID, timingSafeEqual
} from "node:crypto";
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, rmSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";

const execFileAsync=promisify(execFile);

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8880);
const DB_PATH=resolve(process.env.IZAKHONO_CI_DB || "./data/ci.sqlite");
const WORKSPACE_ROOT=resolve(process.env.IZAKHONO_CI_WORKSPACE_ROOT || "./data/workspaces");
const LOG_ROOT=resolve(process.env.IZAKHONO_CI_LOG_ROOT || "./data/logs");
const ADMIN_KEY=process.env.IZAKHONO_CI_ADMIN_KEY || "";
const ENCRYPTION_RAW=process.env.IZAKHONO_CI_ENCRYPTION_KEY || "";
const QUEUE_URL=(process.env.IZAKHONO_QUEUE_URL || "http://127.0.0.1:8810").replace(/\/$/,"");
const QUEUE_KEY=process.env.IZAKHONO_QUEUE_KEY || "";
const CODE_BASE=(process.env.IZAKHONO_CODE_GIT_BASE || "http://127.0.0.1:8860/git").replace(/\/$/,"");
const PACKAGE_URL=(process.env.IZAKHONO_PACKAGE_URL || "").replace(/\/$/,"");
const WORKER_ID=process.env.IZAKHONO_CI_WORKER_ID || "ci-worker";
const POLL_MS=Math.min(5000,Math.max(100,Number(process.env.IZAKHONO_CI_POLL_MS || 750)));
const EXECUTOR=process.env.IZAKHONO_CI_EXECUTOR || "systemd";
const ALLOWED_COMMANDS=new Set((process.env.IZAKHONO_CI_COMMAND_ALLOWLIST || "node,npm,python3,make")
  .split(",").map(x=>x.trim()).filter(Boolean));
const MAX_BODY=Math.min(1024*1024,Math.max(65536,Number(process.env.IZAKHONO_CI_MAX_BODY_BYTES || 262144)));
const DEFAULT_TIMEOUT=Math.min(3600,Math.max(10,Number(process.env.IZAKHONO_CI_STEP_TIMEOUT_SECONDS || 900)));
const DEFAULT_MEMORY=Math.min(32768,Math.max(128,Number(process.env.IZAKHONO_CI_MEMORY_MB || 2048)));
const DEFAULT_CPU=Math.min(800,Math.max(10,Number(process.env.IZAKHONO_CI_CPU_PERCENT || 200)));
const RETAIN_FAILED=process.env.IZAKHONO_CI_RETAIN_FAILED_WORKSPACE==="1";
let workerBusy=false;

function encryptionKey(){
  const key=Buffer.from(ENCRYPTION_RAW,"base64");
  if(key.length!==32) throw new Error("IZAKHONO_CI_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
encryptionKey();

if(EXECUTOR==="direct-test"){
  if(process.env.NODE_ENV!=="test" || process.env.IZAKHONO_CI_ALLOW_INSECURE_TEST_EXECUTOR!=="YES_I_UNDERSTAND"){
    throw new Error("direct-test executor is forbidden outside explicit test mode");
  }
}else if(EXECUTOR!=="systemd"){
  throw new Error("IZAKHONO_CI_EXECUTOR must be systemd in production");
}

mkdirSync(dirname(DB_PATH),{recursive:true});
mkdirSync(WORKSPACE_ROOT,{recursive:true});
mkdirSync(LOG_ROOT,{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec([
  "PRAGMA journal_mode=WAL;",
  "PRAGMA synchronous=NORMAL;",
  "PRAGMA foreign_keys=ON;",
  "PRAGMA busy_timeout=5000;",
  "CREATE TABLE IF NOT EXISTS pipelines(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,repo_slug TEXT NOT NULL,repo_token_encrypted TEXT NOT NULL,git_ref TEXT NOT NULL,steps_json TEXT NOT NULL,network_enabled INTEGER NOT NULL DEFAULT 0,timeout_seconds INTEGER NOT NULL DEFAULT 900,memory_mb INTEGER NOT NULL DEFAULT 2048,cpu_percent INTEGER NOT NULL DEFAULT 200,webhook_secret_encrypted TEXT,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  "CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,pipeline_id TEXT NOT NULL,queue_job_id TEXT,requested_ref TEXT,expected_sha TEXT,actual_sha TEXT,state TEXT NOT NULL CHECK(state IN ('queued','cloning','running','success','failed','infra_failed','cancelled')),started_at TEXT,completed_at TEXT,log_path TEXT,error TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY(pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE);",
  "CREATE INDEX IF NOT EXISTS runs_pipeline_time_idx ON runs(pipeline_id,created_at DESC);",
  "CREATE TABLE IF NOT EXISTS run_steps(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL,step_index INTEGER NOT NULL,command_json TEXT NOT NULL,state TEXT NOT NULL,exit_code INTEGER,started_at TEXT,completed_at TEXT,FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE);",
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
function safeEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}
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
  const d=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(e.iv,"base64"));
  d.setAuthTag(Buffer.from(e.tag,"base64"));
  return Buffer.concat([d.update(Buffer.from(e.ct,"base64")),d.final()]).toString("utf8");
}
function audit(action,target,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,target_ref,outcome,detail_json) VALUES(?,?,?,?)")
    .run(action,target??null,outcome,JSON.stringify(detail));
}
async function readRaw(req,limit=MAX_BODY){
  let total=0;const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req){const b=await readRaw(req);return b.length?JSON.parse(b.toString("utf8")):null;}
function validName(v){return typeof v==="string" && /^[a-z0-9][a-z0-9._-]{1,79}$/.test(v);}
function validRef(v){return typeof v==="string" && /^[A-Za-z0-9._\/-]{1,180}$/.test(v) && !v.includes("..");}
function validSha(v){return v==null || v==="" || /^[0-9a-f]{40}$/i.test(v);}
function pipelineById(id){return db.prepare("SELECT * FROM pipelines WHERE id=?").get(id)||null;}

function normalizeSteps(value){
  if(!Array.isArray(value) || value.length<1 || value.length>30) throw new Error("INVALID_STEPS");
  return value.map(step=>{
    if(!Array.isArray(step) || step.length<1 || step.length>24 || step.some(x=>typeof x!=="string" || x.length>2000)){
      throw new Error("INVALID_STEP");
    }
    if(!ALLOWED_COMMANDS.has(step[0])) throw new Error("COMMAND_NOT_ALLOWED");
    return step;
  });
}

async function queueRequest(path,body){
  if(!QUEUE_KEY) throw new Error("QUEUE_NOT_CONFIGURED");
  const r=await fetch(QUEUE_URL+path,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":QUEUE_KEY},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(5000)
  });
  const p=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(p.error||"QUEUE_ERROR");
  return p;
}

async function enqueueRun(pipeline,{ref,sha,source="manual"}={}){
  const requestedRef=ref||pipeline.git_ref;
  if(!validRef(requestedRef) || !validSha(sha)) throw new Error("INVALID_RUN_REF");
  const runId=randomUUID();
  db.prepare("INSERT INTO runs(id,pipeline_id,requested_ref,expected_sha,state) VALUES(?,?,?,?,\'queued\')")
    .run(runId,pipeline.id,requestedRef,sha||null);
  const uniqueKey=sha?("ci:"+pipeline.id+":"+sha):null;
  const result=await queueRequest("/v1/queues/ci/jobs",{
    uniqueKey,
    maxAttempts:3,
    payload:{runId,pipelineId:pipeline.id,ref:requestedRef,sha:sha||null}
  });
  db.prepare("UPDATE runs SET queue_job_id=? WHERE id=?").run(result.job.id,runId);
  audit("run.enqueue",runId,"success",{pipelineId:pipeline.id,ref:requestedRef,sha:sha||null,source});
  return db.prepare("SELECT * FROM runs WHERE id=?").get(runId);
}

function gitEnv(token){
  const basic=Buffer.from("git:"+token).toString("base64");
  return {
    PATH:process.env.PATH||"/usr/local/bin:/usr/bin:/bin",
    HOME:"/tmp",
    LANG:"C.UTF-8",
    GIT_TERMINAL_PROMPT:"0",
    GIT_CONFIG_COUNT:"1",
    GIT_CONFIG_KEY_0:"http.extraHeader",
    GIT_CONFIG_VALUE_0:"Authorization: Basic "+basic
  };
}

async function cloneRepo(pipeline,run,workspace,logPath){
  const repoDir=join(workspace,"repo");
  const remote=CODE_BASE+"/"+pipeline.repo_slug+".git";
  const token=decrypt(pipeline.repo_token_encrypted);
  appendFileSync(logPath,"[ci] clone "+pipeline.repo_slug+" ref="+run.requested_ref+"\n");
  try{
    await execFileAsync("git",["clone","--depth=1","--branch",run.requested_ref,remote,repoDir],{
      env:gitEnv(token),maxBuffer:20*1024*1024
    });
    let actual=(await execFileAsync("git",["rev-parse","HEAD"],{cwd:repoDir,env:{PATH:process.env.PATH||"/usr/bin:/bin"}})).stdout.trim();
    if(run.expected_sha && actual.toLowerCase()!==run.expected_sha.toLowerCase()){
      await execFileAsync("git",["fetch","--depth=1","origin",run.expected_sha],{cwd:repoDir,env:gitEnv(token),maxBuffer:20*1024*1024});
      await execFileAsync("git",["checkout","--detach",run.expected_sha],{cwd:repoDir,env:{PATH:process.env.PATH||"/usr/bin:/bin"}});
      actual=(await execFileAsync("git",["rev-parse","HEAD"],{cwd:repoDir,env:{PATH:process.env.PATH||"/usr/bin:/bin"}})).stdout.trim();
    }
    if(run.expected_sha && actual.toLowerCase()!==run.expected_sha.toLowerCase()) throw new Error("EXPECTED_SHA_MISMATCH");
    return {repoDir,actualSha:actual};
  }finally{
    // raw repository credential exists only in this function's local scope and child environment.
  }
}

function sanitizedBuildEnv(workspace){
  const home=join(workspace,"home");
  mkdirSync(home,{recursive:true});
  return {
    PATH:process.env.PATH||"/usr/local/bin:/usr/bin:/bin",
    HOME:home,
    LANG:"C.UTF-8",
    CI:"true",
    IZAKHONO_CI:"1",
    ...(PACKAGE_URL?{NPM_CONFIG_REGISTRY:PACKAGE_URL+"/"}:{})
  };
}

async function runProcess(exe,args,{cwd,env,logPath,timeoutMs}){
  return new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{cwd,env,stdio:["ignore","pipe","pipe"]});
    let settled=false;
    const timer=setTimeout(()=>{
      if(!settled){
        child.kill("SIGKILL");
      }
    },timeoutMs);
    child.stdout.on("data",c=>appendFileSync(logPath,c));
    child.stderr.on("data",c=>appendFileSync(logPath,c));
    child.on("error",error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}});
    child.on("close",(code,signal)=>{
      clearTimeout(timer);
      if(!settled){settled=true;resolve({code:Number(code??1),signal});}
    });
  });
}

async function runStep(command,repoDir,workspace,pipeline,logPath){
  const timeout=Math.min(DEFAULT_TIMEOUT,Math.max(10,Number(pipeline.timeout_seconds||DEFAULT_TIMEOUT)));
  if(EXECUTOR==="direct-test"){
    return runProcess(command[0],command.slice(1),{
      cwd:repoDir,env:sanitizedBuildEnv(workspace),logPath,timeoutMs:timeout*1000
    });
  }

  await execFileAsync("chown",["-R","izakhono-ci:izakhono-ci",workspace]);
  const props=[
    "NoNewPrivileges=yes",
    "PrivateTmp=yes",
    "ProtectSystem=strict",
    "ProtectHome=yes",
    "PrivateDevices=yes",
    "RestrictSUIDSGID=yes",
    "LockPersonality=yes",
    "MemoryMax="+Number(pipeline.memory_mb||DEFAULT_MEMORY)+"M",
    "CPUQuota="+Number(pipeline.cpu_percent||DEFAULT_CPU)+"%",
    "RuntimeMaxSec="+timeout,
    "ReadWritePaths="+workspace
  ];
  if(!pipeline.network_enabled) props.push("PrivateNetwork=yes");

  const args=["--quiet","--wait","--collect","--pipe","--service-type=exec","--uid=izakhono-ci"];
  for(const p of props) args.push("--property="+p);
  args.push("--working-directory="+repoDir);
  args.push("--setenv=PATH=/usr/local/bin:/usr/bin:/bin");
  args.push("--setenv=HOME="+join(workspace,"home"));
  args.push("--setenv=CI=true","--setenv=IZAKHONO_CI=1");
  if(PACKAGE_URL) args.push("--setenv=NPM_CONFIG_REGISTRY="+PACKAGE_URL+"/");
  args.push("--");
  args.push(...command);
  return runProcess("systemd-run",args,{
    cwd:"/",env:{PATH:process.env.PATH||"/usr/local/bin:/usr/bin:/bin",LANG:"C.UTF-8"},
    logPath,timeoutMs:(timeout+30)*1000
  });
}

async function executeRun(job){
  const payload=JSON.parse(job.payload_json||"{}");
  const run=db.prepare("SELECT * FROM runs WHERE id=?").get(payload.runId);
  const pipeline=pipelineById(payload.pipelineId);
  if(!run || !pipeline || !pipeline.enabled) throw new Error("CI_RUN_OR_PIPELINE_NOT_FOUND");

  const workspace=join(WORKSPACE_ROOT,run.id);
  const logPath=join(LOG_ROOT,run.id+".log");
  mkdirSync(workspace,{recursive:false,mode:0o700});
  appendFileSync(logPath,"[ci] run="+run.id+" pipeline="+pipeline.name+"\n",{mode:0o600});
  db.prepare("UPDATE runs SET state='cloning',started_at=datetime('now'),log_path=? WHERE id=?").run(logPath,run.id);

  let buildFailed=false;
  try{
    const cloned=await cloneRepo(pipeline,run,workspace,logPath);
    db.prepare("UPDATE runs SET state='running',actual_sha=? WHERE id=?").run(cloned.actualSha,run.id);
    const steps=JSON.parse(pipeline.steps_json);
    for(let i=0;i<steps.length;i++){
      const command=steps[i];
      const sr=db.prepare("INSERT INTO run_steps(run_id,step_index,command_json,state,started_at) VALUES(?,?,?,'running',datetime('now'))")
        .run(run.id,i,JSON.stringify(command));
      appendFileSync(logPath,"\n[ci] step "+(i+1)+": "+command.join(" ")+"\n");
      const result=await runStep(command,cloned.repoDir,workspace,pipeline,logPath);
      db.prepare("UPDATE run_steps SET state=?,exit_code=?,completed_at=datetime('now') WHERE id=?")
        .run(result.code===0?"success":"failed",result.code,sr.lastInsertRowid);
      if(result.code!==0){
        buildFailed=true;
        db.prepare("UPDATE runs SET state='failed',error=?,completed_at=datetime('now') WHERE id=?")
          .run("STEP_"+(i+1)+"_EXIT_"+result.code,run.id);
        audit("run.complete",run.id,"failed",{step:i+1,exitCode:result.code});
        break;
      }
    }
    if(!buildFailed){
      db.prepare("UPDATE runs SET state='success',completed_at=datetime('now') WHERE id=?").run(run.id);
      audit("run.complete",run.id,"success",{sha:cloned.actualSha});
    }
    return {buildFailed,runId:run.id};
  }catch(error){
    db.prepare("UPDATE runs SET state='infra_failed',error=?,completed_at=datetime('now') WHERE id=?")
      .run(String(error?.message||error).slice(0,2000),run.id);
    audit("run.complete",run.id,"failed",{infrastructure:true,error:String(error?.message||error)});
    throw error;
  }finally{
    if(!buildFailed || !RETAIN_FAILED) rmSync(workspace,{recursive:true,force:true});
  }
}

async function workOnce(){
  if(workerBusy || !QUEUE_KEY) return;
  workerBusy=true;
  try{
    const leased=await queueRequest("/v1/queues/ci/lease",{worker:WORKER_ID,leaseSeconds:3600});
    const job=leased.job;
    if(!job) return;
    try{
      await executeRun(job);
      await queueRequest("/v1/jobs/"+encodeURIComponent(job.id)+"/ack",{worker:WORKER_ID});
    }catch(error){
      await queueRequest("/v1/jobs/"+encodeURIComponent(job.id)+"/fail",{
        worker:WORKER_ID,
        error:String(error?.message||error).slice(0,1000),
        retryDelaySeconds:15
      });
    }
  }catch(error){
    if(String(error?.message||"")!=="No job") console.error("ci worker",error);
  }finally{
    workerBusy=false;
  }
}
setInterval(workOnce,POLL_MS).unref();

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO CI WORKER NODE",
        status:"healthy",
        executor:EXECUTOR,
        pipelines:Number(db.prepare("SELECT count(*) AS count FROM pipelines WHERE enabled=1").get()?.count||0),
        running:Number(db.prepare("SELECT count(*) AS count FROM runs WHERE state IN ('cloning','running')").get()?.count||0),
        queueConfigured:Boolean(QUEUE_KEY),
        packageMirrorConfigured:Boolean(PACKAGE_URL),
        productionSandboxRequired:EXECUTOR==="systemd",
        thirdPartyCIRequired:false
      });
    }

    const webhook=url.pathname.match(/^\/v1\/webhooks\/code\/([^/]+)$/);
    if(req.method==="POST" && webhook){
      const pipeline=pipelineById(webhook[1]);
      if(!pipeline || !pipeline.enabled || !pipeline.webhook_secret_encrypted) return json(res,404,{error:"Pipeline webhook not configured"});
      const raw=await readRaw(req);
      const signature=String(req.headers["x-izakhono-signature"]||"");
      const expected="sha256="+createHmac("sha256",decrypt(pipeline.webhook_secret_encrypted)).update(raw).digest("hex");
      if(!safeEqual(signature,expected)) return json(res,401,{error:"Invalid webhook signature"});
      const body=JSON.parse(raw.toString("utf8"));
      if(body.event!=="push" || body.repository?.slug!==pipeline.repo_slug) return json(res,202,{accepted:false,reason:"event-not-relevant"});
      const target="refs/heads/"+pipeline.git_ref;
      const change=Array.isArray(body.changes)?body.changes.find(x=>x.ref===target):null;
      if(!change?.newOid) return json(res,202,{accepted:false,reason:"ref-not-relevant"});
      const run=await enqueueRun(pipeline,{ref:pipeline.git_ref,sha:change.newOid,source:"code-webhook"});
      return json(res,202,{accepted:true,runId:run.id});
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/pipelines"){
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      const repoSlug=String(body?.repoSlug||"").trim().toLowerCase();
      const gitRef=String(body?.ref||"main").trim();
      if(!validName(name) || !validName(repoSlug) || !validRef(gitRef)) return json(res,400,{error:"Invalid pipeline identity"});
      if(typeof body?.repoToken!=="string" || body.repoToken.length<12) return json(res,400,{error:"Repository read token required"});
      const steps=normalizeSteps(body?.steps);
      const id=randomUUID();
      const timeout=Math.min(3600,Math.max(10,Number(body?.timeoutSeconds||DEFAULT_TIMEOUT)));
      const memory=Math.min(32768,Math.max(128,Number(body?.memoryMb||DEFAULT_MEMORY)));
      const cpu=Math.min(800,Math.max(10,Number(body?.cpuPercent||DEFAULT_CPU)));
      const webhookSecret=typeof body?.webhookSecret==="string" && body.webhookSecret.length>=16?encrypt(body.webhookSecret):null;
      db.prepare("INSERT INTO pipelines(id,name,repo_slug,repo_token_encrypted,git_ref,steps_json,network_enabled,timeout_seconds,memory_mb,cpu_percent,webhook_secret_encrypted) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
        .run(id,name,repoSlug,encrypt(body.repoToken),gitRef,JSON.stringify(steps),body?.network===true?1:0,timeout,memory,cpu,webhookSecret);
      audit("pipeline.create",id,"success",{name,repoSlug,gitRef,network:Boolean(body?.network)});
      return json(res,201,{pipeline:{id,name,repoSlug,ref:gitRef,steps,network:Boolean(body?.network),timeoutSeconds:timeout,memoryMb:memory,cpuPercent:cpu,webhookConfigured:Boolean(webhookSecret)}});
    }

    if(req.method==="GET" && url.pathname==="/v1/pipelines"){
      const rows=db.prepare("SELECT id,name,repo_slug,git_ref,steps_json,network_enabled,timeout_seconds,memory_mb,cpu_percent,enabled,created_at,updated_at,CASE WHEN webhook_secret_encrypted IS NULL THEN 0 ELSE 1 END AS webhook_configured FROM pipelines ORDER BY name").all();
      return json(res,200,{pipelines:rows});
    }

    const runMatch=url.pathname.match(/^\/v1\/pipelines\/([^/]+)\/run$/);
    if(req.method==="POST" && runMatch){
      const pipeline=pipelineById(runMatch[1]);
      if(!pipeline || !pipeline.enabled) return json(res,404,{error:"Pipeline not found"});
      const body=await readJson(req);
      const run=await enqueueRun(pipeline,{ref:body?.ref,sha:body?.sha,source:"manual"});
      return json(res,202,{run});
    }

    const runGet=url.pathname.match(/^\/v1\/runs\/([^/]+)$/);
    if(req.method==="GET" && runGet){
      const run=db.prepare("SELECT * FROM runs WHERE id=?").get(runGet[1]);
      if(!run) return json(res,404,{error:"Run not found"});
      const steps=db.prepare("SELECT step_index,command_json,state,exit_code,started_at,completed_at FROM run_steps WHERE run_id=? ORDER BY step_index").all(run.id);
      return json(res,200,{run,steps});
    }

    const logGet=url.pathname.match(/^\/v1\/runs\/([^/]+)\/log$/);
    if(req.method==="GET" && logGet){
      const run=db.prepare("SELECT log_path FROM runs WHERE id=?").get(logGet[1]);
      if(!run?.log_path || !existsSync(run.log_path)) return json(res,404,{error:"Log not found"});
      const text=readFileSync(run.log_path,"utf8");
      return json(res,200,{runId:logGet[1],log:text.slice(-200000)});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(["INVALID_STEPS","INVALID_STEP","COMMAND_NOT_ALLOWED","INVALID_RUN_REF"].includes(message)){
      return json(res,400,{error:message});
    }
    if(String(message).includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log("IZAKHONO CI WORKER NODE listening on http://"+HOST+":"+PORT);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_CI_ADMIN_KEY missing; admin API will reject requests.");
});

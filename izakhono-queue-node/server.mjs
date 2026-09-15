import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8810);
const SERVICE_KEY=process.env.IZAKHONO_QUEUE_KEY || "";
const DB_PATH=resolve(process.env.IZAKHONO_QUEUE_DB || "./data/queue.sqlite");
const MAX_PAYLOAD=Number(process.env.IZAKHONO_QUEUE_MAX_PAYLOAD_BYTES || 256*1024);
const DEFAULT_LEASE=Number(process.env.IZAKHONO_QUEUE_DEFAULT_LEASE_SECONDS || 60);

mkdirSync(dirname(DB_PATH),{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS jobs(
    id TEXT PRIMARY KEY,
    queue TEXT NOT NULL,
    unique_key TEXT,
    payload_json TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','done','dead','cancelled')),
    run_at TEXT NOT NULL DEFAULT (datetime('now')),
    lease_until TEXT,
    leased_by TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    repeat_every_seconds INTEGER,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS jobs_unique_queue_key_idx
    ON jobs(queue,unique_key) WHERE unique_key IS NOT NULL;

  CREATE INDEX IF NOT EXISTS jobs_ready_idx
    ON jobs(queue,state,run_at,lease_until);

  CREATE TABLE IF NOT EXISTS activity_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    job_id TEXT,
    queue TEXT,
    worker TEXT,
    outcome TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );
`);

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
function authenticated(req){ return Boolean(SERVICE_KEY)&&secureEqual(req.headers["x-izakhono-key"],SERVICE_KEY); }
function validQueue(v){ return typeof v==="string" && /^[a-z0-9][a-z0-9-]{1,62}$/.test(v); }

async function readJson(req){
  let total=0; const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>MAX_PAYLOAD) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

function ledger(action,jobId,queue,worker,outcome,detail={}){
  db.prepare(`
    INSERT INTO activity_ledger(action,job_id,queue,worker,outcome,detail_json)
    VALUES(?,?,?,?,?,?)
  `).run(action,jobId??null,queue??null,worker??null,outcome,JSON.stringify(detail));
}

function normalizeIso(value){
  if(value==null) return new Date().toISOString();
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) throw new Error("INVALID_RUN_AT");
  return d.toISOString();
}

function enqueue(queue,body){
  if(!validQueue(queue)) throw new Error("INVALID_QUEUE");
  const id=body?.id || randomUUID();
  const uniqueKey=typeof body?.uniqueKey==="string" && body.uniqueKey.trim()?body.uniqueKey.trim():null;
  const runAt=normalizeIso(body?.runAt);
  const maxAttempts=Math.min(100,Math.max(1,Number(body?.maxAttempts||5)));
  const repeatEverySeconds=body?.repeatEverySeconds==null?null:Math.min(365*24*3600,Math.max(1,Number(body.repeatEverySeconds)));

  try{
    db.prepare(`
      INSERT INTO jobs(id,queue,unique_key,payload_json,run_at,max_attempts,repeat_every_seconds)
      VALUES(?,?,?,?,?,?,?)
    `).run(id,queue,uniqueKey,JSON.stringify(body?.payload??{}),runAt,maxAttempts,repeatEverySeconds);
  }catch(error){
    if(uniqueKey){
      const existing=db.prepare("SELECT * FROM jobs WHERE queue=? AND unique_key=?").get(queue,uniqueKey);
      if(existing) return {created:false,job:existing};
    }
    throw error;
  }

  ledger("job.enqueue",id,queue,null,"executed",{runAt,maxAttempts,repeatEverySeconds});
  return {created:true,job:db.prepare("SELECT * FROM jobs WHERE id=?").get(id)};
}

function recoverExpiredLeases(queue){
  db.prepare(`
    UPDATE jobs
    SET state='queued',leased_by=NULL,lease_until=NULL,updated_at=datetime('now')
    WHERE queue=? AND state='leased' AND lease_until IS NOT NULL AND lease_until<=datetime('now')
  `).run(queue);
}

function lease(queue,worker,leaseSeconds){
  if(!validQueue(queue)) throw new Error("INVALID_QUEUE");
  if(typeof worker!=="string" || !worker.trim()) throw new Error("INVALID_WORKER");
  const seconds=Math.min(3600,Math.max(5,Number(leaseSeconds||DEFAULT_LEASE)));

  recoverExpiredLeases(queue);

  db.exec("BEGIN IMMEDIATE");
  try{
    const candidate=db.prepare(`
      SELECT * FROM jobs
      WHERE queue=? AND state='queued' AND datetime(run_at)<=datetime('now')
      ORDER BY datetime(run_at),created_at
      LIMIT 1
    `).get(queue);

    if(!candidate){
      db.exec("COMMIT");
      return null;
    }

    db.prepare(`
      UPDATE jobs SET
        state='leased',
        leased_by=?,
        lease_until=datetime('now',?),
        attempts=attempts+1,
        updated_at=datetime('now')
      WHERE id=? AND state='queued'
    `).run(worker,"+"+seconds+" seconds",candidate.id);

    const leased=db.prepare("SELECT * FROM jobs WHERE id=?").get(candidate.id);
    db.exec("COMMIT");
    ledger("job.lease",leased.id,queue,worker,"executed",{leaseSeconds:seconds,attempt:leased.attempts});
    return leased;
  }catch(error){
    db.exec("ROLLBACK");
    throw error;
  }
}

function ack(id,worker){
  const job=db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
  if(!job) throw new Error("JOB_NOT_FOUND");
  if(job.state!=="leased" || job.leased_by!==worker) throw new Error("LEASE_MISMATCH");

  db.exec("BEGIN IMMEDIATE");
  try{
    db.prepare(`
      UPDATE jobs SET state='done',completed_at=datetime('now'),lease_until=NULL,updated_at=datetime('now')
      WHERE id=?
    `).run(id);

    if(job.repeat_every_seconds){
      const nextId=randomUUID();
      db.prepare(`
        INSERT INTO jobs(id,queue,payload_json,run_at,max_attempts,repeat_every_seconds)
        VALUES(?,?,?,datetime('now',?),?,?)
      `).run(nextId,job.queue,job.payload_json,"+"+job.repeat_every_seconds+" seconds",job.max_attempts,job.repeat_every_seconds);
      ledger("job.repeat",nextId,job.queue,null,"executed",{from:id});
    }
    db.exec("COMMIT");
  }catch(error){
    db.exec("ROLLBACK");
    throw error;
  }

  ledger("job.ack",id,job.queue,worker,"executed",{});
  return db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
}

function fail(id,worker,errorText,retryDelaySeconds=30){
  const job=db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
  if(!job) throw new Error("JOB_NOT_FOUND");
  if(job.state!=="leased" || job.leased_by!==worker) throw new Error("LEASE_MISMATCH");

  const exhausted=Number(job.attempts)>=Number(job.max_attempts);
  if(exhausted){
    db.prepare(`
      UPDATE jobs SET state='dead',last_error=?,lease_until=NULL,updated_at=datetime('now')
      WHERE id=?
    `).run(String(errorText||"failed").slice(0,4000),id);
    ledger("job.fail",id,job.queue,worker,"dead",{attempts:job.attempts});
  }else{
    const delay=Math.min(86400,Math.max(0,Number(retryDelaySeconds||0)));
    db.prepare(`
      UPDATE jobs SET state='queued',leased_by=NULL,lease_until=NULL,last_error=?,
        run_at=datetime('now',?),updated_at=datetime('now')
      WHERE id=?
    `).run(String(errorText||"failed").slice(0,4000),"+"+delay+" seconds",id);
    ledger("job.fail",id,job.queue,worker,"retry",{attempts:job.attempts,delay});
  }
  return db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO QUEUE NODE",
        status:"healthy",
        queued:Number(db.prepare("SELECT count(*) AS count FROM jobs WHERE state='queued'").get()?.count||0),
        leased:Number(db.prepare("SELECT count(*) AS count FROM jobs WHERE state='leased'").get()?.count||0),
        dead:Number(db.prepare("SELECT count(*) AS count FROM jobs WHERE state='dead'").get()?.count||0),
        thirdPartyQueueRequired:false
      });
    }

    if(!authenticated(req)) return json(res,401,{error:"Unauthorized"});

    const enqueueMatch=url.pathname.match(/^\/v1\/queues\/([^/]+)\/jobs$/);
    if(req.method==="POST" && enqueueMatch){
      const body=await readJson(req);
      const result=enqueue(decodeURIComponent(enqueueMatch[1]),body||{});
      return json(res,result.created?201:200,result);
    }

    const leaseMatch=url.pathname.match(/^\/v1\/queues\/([^/]+)\/lease$/);
    if(req.method==="POST" && leaseMatch){
      const body=await readJson(req);
      const job=lease(decodeURIComponent(leaseMatch[1]),body?.worker,body?.leaseSeconds);
      return json(res,200,{job});
    }

    const ackMatch=url.pathname.match(/^\/v1\/jobs\/([^/]+)\/ack$/);
    if(req.method==="POST" && ackMatch){
      const body=await readJson(req);
      return json(res,200,{job:ack(ackMatch[1],body?.worker)});
    }

    const failMatch=url.pathname.match(/^\/v1\/jobs\/([^/]+)\/fail$/);
    if(req.method==="POST" && failMatch){
      const body=await readJson(req);
      return json(res,200,{job:fail(failMatch[1],body?.worker,body?.error,body?.retryDelaySeconds)});
    }

    const cancelMatch=url.pathname.match(/^\/v1\/jobs\/([^/]+)\/cancel$/);
    if(req.method==="POST" && cancelMatch){
      const result=db.prepare(`
        UPDATE jobs SET state='cancelled',lease_until=NULL,updated_at=datetime('now')
        WHERE id=? AND state IN ('queued','leased')
      `).run(cancelMatch[1]);
      return json(res,Number(result.changes||0)?200:409,{cancelled:Number(result.changes||0)>0});
    }

    const statsMatch=url.pathname.match(/^\/v1\/queues\/([^/]+)\/stats$/);
    if(req.method==="GET" && statsMatch){
      const queue=decodeURIComponent(statsMatch[1]);
      if(!validQueue(queue)) return json(res,400,{error:"Invalid queue"});
      const states=db.prepare("SELECT state,count(*) AS count FROM jobs WHERE queue=? GROUP BY state").all(queue);
      return json(res,200,{queue,states});
    }

    const deadMatch=url.pathname.match(/^\/v1\/queues\/([^/]+)\/dead$/);
    if(req.method==="GET" && deadMatch){
      const queue=decodeURIComponent(deadMatch[1]);
      if(!validQueue(queue)) return json(res,400,{error:"Invalid queue"});
      return json(res,200,{queue,jobs:db.prepare("SELECT * FROM jobs WHERE queue=? AND state='dead' ORDER BY updated_at DESC LIMIT 200").all(queue)});
    }

    if(req.method==="GET" && url.pathname==="/v1/ledger"){
      return json(res,200,{entries:db.prepare("SELECT * FROM activity_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="PAYLOAD_TOO_LARGE") return json(res,413,{error:"Payload too large"});
    if(["INVALID_QUEUE","INVALID_WORKER","INVALID_RUN_AT","JOB_NOT_FOUND","LEASE_MISMATCH"].includes(message)){
      return json(res,400,{error:message});
    }
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO QUEUE NODE listening on http://${HOST}:${PORT}`);
  if(!SERVICE_KEY) console.warn("WARNING: IZAKHONO_QUEUE_KEY missing; protected API will reject requests.");
});

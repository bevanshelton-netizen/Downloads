import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8920);
const ADMIN_KEY=process.env.IZAKHONO_FAILOVER_KEY || "";
const DB_PATH=resolve(process.env.IZAKHONO_FAILOVER_DB || "./data/failover.sqlite");
const IS_TEST=process.env.NODE_ENV==="test";
const MONITOR_MS=Math.max(IS_TEST?100:1000,Number(process.env.IZAKHONO_FAILOVER_MONITOR_MS || 5000));
const FAIL_SAMPLES=Math.min(20,Math.max(2,Number(process.env.IZAKHONO_FAILOVER_FAIL_SAMPLES || 3)));
const PROBE_TIMEOUT_MS=Math.min(15000,Math.max(250,Number(process.env.IZAKHONO_FAILOVER_PROBE_TIMEOUT_MS || 2500)));

mkdirSync(dirname(DB_PATH),{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS services(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    active_url TEXT NOT NULL,
    standby_url TEXT NOT NULL,
    expected_product TEXT,
    route_name TEXT,
    epoch INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'monitoring',
    active_ok INTEGER,
    standby_ok INTEGER,
    consecutive_active_failures INTEGER NOT NULL DEFAULT 0,
    promotion_locked INTEGER NOT NULL DEFAULT 0,
    last_probe_at TEXT,
    last_active_error TEXT,
    last_standby_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proposals(
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    from_epoch INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('candidate','approved','completed','cancelled','stale')),
    reason TEXT NOT NULL,
    fence_evidence TEXT,
    route_evidence TEXT,
    actor TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS proposals_service_idx ON proposals(service_id,created_at DESC);

  CREATE TABLE IF NOT EXISTS audit_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    service_id TEXT,
    proposal_id TEXT,
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

function safeEqual(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}
function admin(req){ return Boolean(ADMIN_KEY) && safeEqual(req.headers["x-izakhono-key"],ADMIN_KEY); }
function validName(v){ return typeof v==="string" && /^[a-z0-9][a-z0-9._-]{1,79}$/.test(v); }

function safeHealthUrl(value){
  if(typeof value!=="string" || value.length>1024) throw new Error("INVALID_URL");
  const u=new URL(value);
  if(!["http:","https:"].includes(u.protocol) || u.username || u.password || u.hash) throw new Error("INVALID_URL");
  return u.toString();
}

function audit(action,serviceId,proposalId,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,service_id,proposal_id,outcome,detail_json) VALUES(?,?,?,?,?)")
    .run(action,serviceId??null,proposalId??null,outcome,JSON.stringify(detail));
}

async function readJson(req,limit=128*1024){
  let total=0; const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

async function probe(url,expectedProduct){
  try{
    const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(PROBE_TIMEOUT_MS)});
    if(!r.ok) return {ok:false,error:"HTTP_"+r.status};
    const contentType=r.headers.get("content-type")||"";
    if(contentType.includes("json")){
      const body=await r.json();
      if(body?.status && body.status!=="healthy") return {ok:false,error:"STATUS_"+String(body.status)};
      if(expectedProduct && body?.product!==expectedProduct) return {ok:false,error:"PRODUCT_MISMATCH"};
    }else if(expectedProduct){
      return {ok:false,error:"EXPECTED_JSON_PRODUCT"};
    }
    return {ok:true,error:null};
  }catch(error){
    return {ok:false,error:String(error?.message||error).slice(0,500)};
  }
}

function activeCandidate(serviceId){
  return db.prepare("SELECT * FROM proposals WHERE service_id=? AND status='candidate' ORDER BY created_at DESC LIMIT 1").get(serviceId)||null;
}

function markCandidatesStale(serviceId){
  db.prepare("UPDATE proposals SET status='stale',cancelled_at=datetime('now') WHERE service_id=? AND status='candidate'").run(serviceId);
}

async function probeService(id){
  const s=db.prepare("SELECT * FROM services WHERE id=?").get(id);
  if(!s) throw new Error("SERVICE_NOT_FOUND");

  const [active,standby]=await Promise.all([
    probe(s.active_url,s.expected_product),
    probe(s.standby_url,s.expected_product)
  ]);

  let failures=active.ok?0:Number(s.consecutive_active_failures||0)+1;
  let state=s.state;

  if(!s.promotion_locked){
    if(active.ok){
      state=standby.ok?"healthy":"healthy-standby-degraded";
      if(activeCandidate(id)) {
        markCandidatesStale(id);
        audit("proposal.stale",id,null,"success",{reason:"active-recovered"});
      }
    }else if(!standby.ok){
      state="degraded-no-standby";
    }else if(failures>=FAIL_SAMPLES){
      state="failover-candidate";
      if(!activeCandidate(id)){
        const pid=randomUUID();
        db.prepare("INSERT INTO proposals(id,service_id,from_epoch,status,reason) VALUES(?,?,?,'candidate',?)")
          .run(pid,id,s.epoch,"active-unhealthy-standby-healthy");
        audit("proposal.create",id,pid,"success",{failures});
      }
    }else{
      state="degraded-observing";
    }
  }else{
    state="promotion-approved";
  }

  db.prepare(`
    UPDATE services SET active_ok=?,standby_ok=?,consecutive_active_failures=?,state=?,
      last_probe_at=datetime('now'),last_active_error=?,last_standby_error=?,updated_at=datetime('now')
    WHERE id=?
  `).run(active.ok?1:0,standby.ok?1:0,failures,state,active.error,standby.error,id);

  audit("service.probe",id,null,"success",{active,standby,failures,state});
  return db.prepare("SELECT * FROM services WHERE id=?").get(id);
}

let monitorBusy=false;
async function monitorAll(){
  if(monitorBusy) return;
  monitorBusy=true;
  try{
    const rows=db.prepare("SELECT id FROM services ORDER BY name").all();
    for(const row of rows) await probeService(row.id);
  }catch(error){
    console.error("failover monitor",error);
  }finally{
    monitorBusy=false;
  }
}
setInterval(monitorAll,MONITOR_MS).unref();

function serviceView(id){
  const service=db.prepare("SELECT * FROM services WHERE id=?").get(id);
  if(!service) return null;
  const proposal=db.prepare("SELECT * FROM proposals WHERE service_id=? ORDER BY created_at DESC LIMIT 1").get(id)||null;
  return {service,proposal};
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO FAILOVER NODE",
        status:"healthy",
        services:Number(db.prepare("SELECT count(*) AS count FROM services").get()?.count||0),
        candidates:Number(db.prepare("SELECT count(*) AS count FROM proposals WHERE status='candidate'").get()?.count||0),
        automaticPromotion:false,
        promotionExecution:"manual-route-switch-after-fencing",
        splitBrainProtection:"fence-required",
        thirdPartyFailoverServiceRequired:false
      });
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/services"){
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!validName(name)) return json(res,400,{error:"Invalid service name"});
      const activeUrl=safeHealthUrl(body?.activeUrl);
      const standbyUrl=safeHealthUrl(body?.standbyUrl);
      if(activeUrl===standbyUrl) return json(res,400,{error:"Active and standby must be different endpoints"});
      const id=randomUUID();
      db.prepare(`
        INSERT INTO services(id,name,active_url,standby_url,expected_product,route_name)
        VALUES(?,?,?,?,?,?)
      `).run(id,name,activeUrl,standbyUrl,body?.expectedProduct?String(body.expectedProduct).slice(0,160):null,body?.routeName?String(body.routeName).slice(0,253):null);
      audit("service.create",id,null,"success",{name});
      return json(res,201,serviceView(id));
    }

    if(req.method==="GET" && url.pathname==="/v1/services"){
      return json(res,200,{services:db.prepare("SELECT * FROM services ORDER BY name").all()});
    }

    const serviceGet=url.pathname.match(/^\/v1\/services\/([^/]+)$/);
    if(req.method==="GET" && serviceGet){
      const view=serviceView(serviceGet[1]);
      if(!view) return json(res,404,{error:"Service not found"});
      return json(res,200,view);
    }

    const forceProbe=url.pathname.match(/^\/v1\/services\/([^/]+)\/probe$/);
    if(req.method==="POST" && forceProbe){
      const service=await probeService(forceProbe[1]);
      return json(res,200,{service,proposal:activeCandidate(service.id)});
    }

    const approve=url.pathname.match(/^\/v1\/proposals\/([^/]+)\/approve$/);
    if(req.method==="POST" && approve){
      const body=await readJson(req);
      const p=db.prepare("SELECT * FROM proposals WHERE id=?").get(approve[1]);
      if(!p || p.status!=="candidate") return json(res,409,{error:"Proposal is not an active candidate"});
      const s=db.prepare("SELECT * FROM services WHERE id=?").get(p.service_id);
      if(!s || s.active_ok!==0 || s.standby_ok!==1 || Number(s.consecutive_active_failures)<FAIL_SAMPLES){
        return json(res,409,{error:"Current health no longer satisfies failover conditions"});
      }
      if(body?.confirm!=="PROMOTE") return json(res,400,{error:"Explicit confirm=PROMOTE required"});
      if(body?.activeFenced!==true || typeof body?.fenceEvidence!=="string" || body.fenceEvidence.trim().length<8){
        audit("promotion.blocked",p.service_id,p.id,"blocked",{reason:"fence-required"});
        return json(res,409,{
          error:"Active node fencing evidence is required before promotion approval",
          splitBrainRisk:true
        });
      }
      const actor=String(body?.actor||"owner").slice(0,120);
      db.exec("BEGIN IMMEDIATE");
      try{
        db.prepare(`
          UPDATE proposals SET status='approved',fence_evidence=?,actor=?,approved_at=datetime('now')
          WHERE id=? AND status='candidate'
        `).run(body.fenceEvidence.trim().slice(0,2000),actor,p.id);
        db.prepare(`
          UPDATE services SET promotion_locked=1,state='promotion-approved',epoch=epoch+1,updated_at=datetime('now')
          WHERE id=?
        `).run(p.service_id);
        db.exec("COMMIT");
      }catch(error){db.exec("ROLLBACK");throw error;}
      audit("promotion.approve",p.service_id,p.id,"success",{actor});
      const updated=db.prepare("SELECT * FROM services WHERE id=?").get(p.service_id);
      return json(res,200,{
        approved:true,
        automaticRouteChange:false,
        execution:"manual-route-switch-required",
        targetUrl:updated.standby_url,
        routeName:updated.route_name,
        epoch:updated.epoch
      });
    }

    const complete=url.pathname.match(/^\/v1\/proposals\/([^/]+)\/complete$/);
    if(req.method==="POST" && complete){
      const body=await readJson(req);
      const p=db.prepare("SELECT * FROM proposals WHERE id=?").get(complete[1]);
      if(!p || p.status!=="approved") return json(res,409,{error:"Proposal is not approved"});
      if(body?.confirm!=="ROUTE_SWITCHED" || typeof body?.routeEvidence!=="string" || body.routeEvidence.trim().length<8){
        return json(res,400,{error:"Explicit route-switch evidence is required"});
      }
      const s=db.prepare("SELECT * FROM services WHERE id=?").get(p.service_id);
      db.exec("BEGIN IMMEDIATE");
      try{
        db.prepare("UPDATE proposals SET status='completed',route_evidence=?,completed_at=datetime('now') WHERE id=?")
          .run(body.routeEvidence.trim().slice(0,2000),p.id);
        db.prepare(`
          UPDATE services SET active_url=?,standby_url=?,promotion_locked=0,state='monitoring',
            consecutive_active_failures=0,active_ok=NULL,standby_ok=NULL,updated_at=datetime('now')
          WHERE id=?
        `).run(s.standby_url,s.active_url,s.id);
        db.exec("COMMIT");
      }catch(error){db.exec("ROLLBACK");throw error;}
      audit("promotion.complete",s.id,p.id,"success",{});
      return json(res,200,{completed:true,...serviceView(s.id)});
    }

    const cancel=url.pathname.match(/^\/v1\/proposals\/([^/]+)\/cancel$/);
    if(req.method==="POST" && cancel){
      const body=await readJson(req);
      const p=db.prepare("SELECT * FROM proposals WHERE id=?").get(cancel[1]);
      if(!p || !["candidate","approved"].includes(p.status)) return json(res,409,{error:"Proposal cannot be cancelled"});
      db.prepare("UPDATE proposals SET status='cancelled',cancelled_at=datetime('now') WHERE id=?").run(p.id);
      db.prepare("UPDATE services SET promotion_locked=0,state='monitoring',updated_at=datetime('now') WHERE id=?").run(p.service_id);
      audit("proposal.cancel",p.service_id,p.id,"success",{reason:String(body?.reason||"manual").slice(0,500)});
      return json(res,200,{cancelled:true});
    }

    if(req.method==="GET" && url.pathname==="/v1/proposals"){
      return json(res,200,{proposals:db.prepare("SELECT * FROM proposals ORDER BY created_at DESC LIMIT 500").all()});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=String(error?.message||"Unknown error");
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(message==="INVALID_URL") return json(res,400,{error:"Invalid health URL"});
    if(message==="SERVICE_NOT_FOUND") return json(res,404,{error:"Service not found"});
    if(message.includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO FAILOVER NODE listening on http://${HOST}:${PORT}`);
  console.log("Automatic promotion is disabled; fencing and explicit route-switch confirmation are required.");
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_FAILOVER_KEY missing; control API will reject requests.");
});

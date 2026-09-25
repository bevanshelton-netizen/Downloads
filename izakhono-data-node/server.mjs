import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DB_PATH = resolve(process.env.IZAKHONO_DATA_DB || "./data/izakhono-data.sqlite");
const SERVICE_KEY = process.env.IZAKHONO_DATA_KEY || "";

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    event_name TEXT NOT NULL CHECK(event_name IN (
      'page_view','lead','qualified_lead','application',
      'enrolment','order','payment','refund'
    )),
    occurred_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    brand TEXT NOT NULL,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    country TEXT,
    language TEXT,
    landing_page TEXT,
    lead_id TEXT,
    customer_id TEXT,
    order_id TEXT,
    value REAL,
    currency TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS events_occurred_at_idx ON events(occurred_at DESC);
  CREATE INDEX IF NOT EXISTS events_brand_idx ON events(brand, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS events_campaign_idx ON events(campaign);
  CREATE INDEX IF NOT EXISTS events_lead_idx ON events(lead_id);
  CREATE INDEX IF NOT EXISTS events_customer_idx ON events(customer_id);
  CREATE INDEX IF NOT EXISTS events_order_idx ON events(order_id);

  CREATE TABLE IF NOT EXISTS provider_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    external_account_id TEXT,
    external_account_name TEXT,
    connection_state TEXT NOT NULL DEFAULT 'oauth-required',
    granted_scopes_json TEXT NOT NULL DEFAULT '[]',
    encrypted_token_envelope_json TEXT,
    token_expires_at TEXT,
    connected_at TEXT,
    rotated_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, external_account_id)
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    provider TEXT,
    external_account_id TEXT,
    campaign_ref TEXT,
    requested_payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    executed_at TEXT,
    decision_note TEXT
  );

  CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status, requested_at DESC);

  CREATE TABLE IF NOT EXISTS activity_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    actor_type TEXT NOT NULL,
    actor_ref TEXT,
    action TEXT NOT NULL,
    provider TEXT,
    external_account_id TEXT,
    approval_id TEXT,
    outcome TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS activity_occurred_at_idx ON activity_ledger(occurred_at DESC);

  CREATE TABLE IF NOT EXISTS conversion_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    external_account_id TEXT,
    growth_event_name TEXT NOT NULL,
    provider_conversion_ref TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, external_account_id, growth_event_name, provider_conversion_ref)
  );

  INSERT OR IGNORE INTO meta(key,value) VALUES ('schema_version','1');
`);

const allowedEvents = new Set([
  "page_view","lead","qualified_lead","application",
  "enrolment","order","payment","refund"
]);

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
  const aa=Buffer.from(a||"");
  const bb=Buffer.from(b||"");
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}

function authenticated(req){
  if(!SERVICE_KEY) return false;
  return secureEqual(req.headers["x-izakhono-key"],SERVICE_KEY);
}

function localRequest(req){
  const address=String(req.socket?.remoteAddress||"").toLowerCase();
  return address==="127.0.0.1" || address==="::1" || address==="::ffff:127.0.0.1";
}

async function readBody(req,limit=1024*1024){
  let total=0;
  const chunks=[];
  for await (const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  if(chunks.length===0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeEvent(event){
  if(!event || typeof event!=="object") throw new Error("INVALID_EVENT");
  if(typeof event.eventId!=="string" || !event.eventId.trim()) throw new Error("INVALID_EVENT_ID");
  if(!allowedEvents.has(event.eventName)) throw new Error("INVALID_EVENT_NAME");
  if(typeof event.occurredAt!=="string" || !event.occurredAt.trim()) throw new Error("INVALID_OCCURRED_AT");
  if(typeof event.brand!=="string" || !event.brand.trim()) throw new Error("INVALID_BRAND");
  return {
    eventId:event.eventId.trim(),
    eventName:event.eventName,
    occurredAt:event.occurredAt,
    brand:event.brand.trim(),
    source:event.source??null,
    medium:event.medium??null,
    campaign:event.campaign??null,
    country:event.country??null,
    language:event.language??null,
    landingPage:event.landingPage??null,
    leadId:event.leadId??null,
    customerId:event.customerId??null,
    orderId:event.orderId??null,
    value:typeof event.value==="number"?event.value:null,
    currency:typeof event.currency==="string"?event.currency.toUpperCase():null,
    metadata:event.metadata && typeof event.metadata==="object" ? event.metadata : {}
  };
}

const insertEvent=db.prepare(`
  INSERT INTO events(
    event_id,event_name,occurred_at,brand,source,medium,campaign,country,language,
    landing_page,lead_id,customer_id,order_id,value,currency,metadata_json
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(event_id) DO NOTHING
`);

const insertLedger=db.prepare(`
  INSERT INTO activity_ledger(actor_type,actor_ref,action,provider,external_account_id,approval_id,outcome,detail_json)
  VALUES(?,?,?,?,?,?,?,?)
`);

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      const count=db.prepare("SELECT count(*) AS count FROM events").get();
      return json(res,200,{
        product:"IZAKHONO DATA NODE",
        status:"healthy",
        schemaVersion:db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value||"unknown",
        database:DB_PATH,
        eventCount:Number(count?.count||0),
        liveWrites:true,
        thirdPartyDatabase:false
      });
    }

    const campaignSales=url.pathname.match(/^\/v1\/local\/campaigns\/([^/]+)\/sales$/);
    if(req.method==="GET" && campaignSales){
      if(!localRequest(req)) return json(res,403,{error:"Loopback only"});
      const campaign=decodeURIComponent(campaignSales[1]);
      const brand=String(url.searchParams.get("brand")||"").trim();
      if(!brand) return json(res,400,{error:"brand is required"});
      const row=db.prepare(`
        SELECT
          coalesce(sum(CASE WHEN event_name='payment' THEN coalesce(value,0) ELSE 0 END),0) AS paid,
          coalesce(sum(CASE WHEN event_name='refund' THEN abs(coalesce(value,0)) ELSE 0 END),0) AS refunded,
          count(*) FILTER (WHERE event_name='payment') AS payment_count,
          coalesce(sum(CASE
            WHEN event_name='payment' THEN max(1,coalesce(cast(json_extract(metadata_json,'$.quantity') AS INTEGER),1))
            ELSE 0
          END),0) AS units
        FROM events
        WHERE brand=? AND campaign=? AND event_name IN ('payment','refund')
      `).get(brand,campaign);
      const paid=Number(row?.paid||0);
      const refunded=Number(row?.refunded||0);
      return json(res,200,{
        source:"IZAKHONO DATA NODE",
        brand,
        campaign,
        paid_sales:Math.max(0,paid-refunded),
        gross_paid:paid,
        refunded,
        payment_count:Number(row?.payment_count||0),
        units:Number(row?.units||0)
      });
    }

    if(!authenticated(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/events"){
      const body=await readBody(req);
      const incoming=Array.isArray(body)?body:[body];
      if(incoming.length===0 || incoming.length>100) return json(res,400,{error:"Batch must contain 1-100 events."});

      let inserted=0;
      let duplicates=0;
      db.exec("BEGIN IMMEDIATE");
      try{
        for(const raw of incoming){
          const e=normalizeEvent(raw);
          const result=insertEvent.run(
            e.eventId,e.eventName,e.occurredAt,e.brand,e.source,e.medium,e.campaign,e.country,e.language,
            e.landingPage,e.leadId,e.customerId,e.orderId,e.value,e.currency,JSON.stringify(e.metadata)
          );
          if(Number(result.changes||0)>0) inserted++; else duplicates++;
        }
        db.exec("COMMIT");
      }catch(error){
        db.exec("ROLLBACK");
        throw error;
      }

      const result={inserted,duplicates};
      insertLedger.run("system","growth-os","events.ingest",null,null,null,"executed",JSON.stringify(result));
      return json(res,202,{accepted:true,...result});
    }

    if(req.method==="GET" && url.pathname==="/v1/stats"){
      const eventTotals=db.prepare(`
        SELECT event_name AS eventName,count(*) AS count,coalesce(sum(value),0) AS value
        FROM events GROUP BY event_name ORDER BY count DESC
      `).all();
      const brands=db.prepare(`
        SELECT brand,count(*) AS count,coalesce(sum(CASE WHEN event_name='payment' THEN value ELSE 0 END),0) AS revenue
        FROM events GROUP BY brand ORDER BY revenue DESC,count DESC
      `).all();
      return json(res,200,{eventTotals,brands});
    }

    if(req.method==="POST" && url.pathname==="/v1/approvals"){
      const body=await readBody(req);
      if(!body?.actionType) return json(res,400,{error:"actionType required"});
      const id=body.id||randomUUID();
      db.prepare(`
        INSERT INTO approvals(id,action_type,provider,external_account_id,campaign_ref,requested_payload_json,status)
        VALUES(?,?,?,?,?,?, 'pending')
      `).run(
        id,body.actionType,body.provider??null,body.externalAccountId??null,body.campaignRef??null,
        JSON.stringify(body.requestedPayload||{})
      );
      insertLedger.run("system","growth-os","approval.requested",body.provider??null,body.externalAccountId??null,id,"proposed",JSON.stringify(body.requestedPayload||{}));
      return json(res,201,{id,status:"pending"});
    }

    const decision=url.pathname.match(/^\/v1\/approvals\/([^/]+)\/decision$/);
    if(req.method==="POST" && decision){
      const body=await readBody(req);
      if(!["approved","rejected","cancelled"].includes(body?.status)) return json(res,400,{error:"status must be approved, rejected, or cancelled"});
      const result=db.prepare(`
        UPDATE approvals SET status=?,decided_at=datetime('now'),decision_note=? WHERE id=? AND status='pending'
      `).run(body.status,body.note??null,decision[1]);
      if(Number(result.changes||0)===0) return json(res,409,{error:"Approval not pending or not found"});
      insertLedger.run("user",body.actorRef??"owner","approval.decision",null,null,decision[1],body.status,JSON.stringify({note:body.note??null}));
      return json(res,200,{id:decision[1],status:body.status});
    }

    if(req.method==="GET" && url.pathname==="/v1/approvals"){
      return json(res,200,{approvals:db.prepare("SELECT * FROM approvals ORDER BY requested_at DESC LIMIT 200").all()});
    }

    if(req.method==="GET" && url.pathname==="/v1/ledger"){
      return json(res,200,{entries:db.prepare("SELECT * FROM activity_ledger ORDER BY occurred_at DESC,id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(message.startsWith("INVALID_")) return json(res,400,{error:message});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO DATA NODE listening on http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  if(!SERVICE_KEY) console.warn("WARNING: IZAKHONO_DATA_KEY is not configured; protected API will reject all requests.");
});

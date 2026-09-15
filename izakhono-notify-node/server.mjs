import { createServer } from "node:http";
import {
  createCipheriv, createDecipheriv, createHmac,
  randomBytes, randomUUID, timingSafeEqual
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8840);
const DB_PATH=resolve(process.env.IZAKHONO_NOTIFY_DB || "./data/notify.sqlite");
const SERVICE_KEY=process.env.IZAKHONO_NOTIFY_KEY || "";
const ENCRYPTION_RAW=process.env.IZAKHONO_NOTIFY_ENCRYPTION_KEY || "";
const QUEUE_URL=(process.env.IZAKHONO_QUEUE_URL || "http://127.0.0.1:8810").replace(/\/$/,"");
const QUEUE_KEY=process.env.IZAKHONO_QUEUE_KEY || "";
const WORKER_ID=process.env.IZAKHONO_NOTIFY_WORKER_ID || "notify-node";
const POLL_MS=Math.min(5000,Math.max(50,Number(process.env.IZAKHONO_NOTIFY_POLL_MS || 500)));
const RETRY_BASE=Math.min(3600,Math.max(0,Number(process.env.IZAKHONO_NOTIFY_RETRY_BASE_SECONDS || 5)));
const ADAPTER_KEY=process.env.IZAKHONO_NOTIFY_ADAPTER_KEY || "";
const EMAIL_ADAPTER=process.env.IZAKHONO_EMAIL_ADAPTER_URL || "";
const SMS_ADAPTER=process.env.IZAKHONO_SMS_ADAPTER_URL || "";
const WHATSAPP_ADAPTER=process.env.IZAKHONO_WHATSAPP_ADAPTER_URL || "";
const WEBHOOK_ALLOWLIST=(process.env.IZAKHONO_NOTIFY_WEBHOOK_ALLOWLIST || "").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);

function encryptionKey(){
  const key=Buffer.from(ENCRYPTION_RAW,"base64");
  if(key.length!==32) throw new Error("IZAKHONO_NOTIFY_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
encryptionKey();

mkdirSync(dirname(DB_PATH),{recursive:true});
const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS templates(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipient_channels(
    recipient_ref TEXT NOT NULL,
    channel TEXT NOT NULL,
    address_encrypted TEXT NOT NULL,
    address_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(recipient_ref,channel)
  );

  CREATE TABLE IF NOT EXISTS preferences(
    recipient_ref TEXT NOT NULL,
    channel TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(recipient_ref,channel)
  );

  CREATE TABLE IF NOT EXISTS suppressions(
    channel TEXT NOT NULL,
    address_hash TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(channel,address_hash)
  );

  CREATE TABLE IF NOT EXISTS messages(
    id TEXT PRIMARY KEY,
    recipient_ref TEXT NOT NULL,
    channel TEXT NOT NULL,
    template_id TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','delivering','retrying','delivered','dead','suppressed','cancelled')),
    idempotency_key TEXT UNIQUE,
    scheduled_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(template_id) REFERENCES templates(id)
  );

  CREATE INDEX IF NOT EXISTS messages_state_time_idx ON messages(state,scheduled_at);
  CREATE INDEX IF NOT EXISTS messages_recipient_idx ON messages(recipient_ref,created_at DESC);

  CREATE TABLE IF NOT EXISTS inbox(
    id TEXT PRIMARY KEY,
    recipient_ref TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    subject TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT,
    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS inbox_recipient_idx ON inbox(recipient_ref,created_at DESC);

  CREATE TABLE IF NOT EXISTS delivery_attempts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    channel TEXT NOT NULL,
    outcome TEXT NOT NULL,
    response_code INTEGER,
    error TEXT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    target_ref TEXT,
    outcome TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );
`);

const channels=new Set(["in_app","email","sms","whatsapp","webhook"]);
let workerBusy=false;

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
function authenticated(req){return Boolean(SERVICE_KEY)&&safeEqual(req.headers["x-izakhono-key"],SERVICE_KEY);}
function hashAddress(channel,address){return createHmac("sha256",encryptionKey()).update(channel+"|"+address).digest("hex");}

function encrypt(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const ct=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:tag.toString("base64"),ct:ct.toString("base64")});
}
function decrypt(value){
  const e=JSON.parse(value);
  if(e.v!==1) throw new Error("UNSUPPORTED_ENVELOPE");
  const d=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(e.iv,"base64"));
  d.setAuthTag(Buffer.from(e.tag,"base64"));
  return Buffer.concat([d.update(Buffer.from(e.ct,"base64")),d.final()]).toString("utf8");
}

async function readJson(req,limit=256*1024){
  let total=0;const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

function validChannel(v){return channels.has(v);}
function validRecipientRef(v){return typeof v==="string" && /^[A-Za-z0-9_.:@-]{1,120}$/.test(v);}
function normalizeAddress(channel,address){
  if(typeof address!=="string") throw new Error("INVALID_ADDRESS");
  const value=address.trim();
  if(channel==="email"){
    if(value.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("INVALID_ADDRESS");
    return value.toLowerCase();
  }
  if(channel==="sms" || channel==="whatsapp"){
    const phone=value.replace(/[\s()-]/g,"");
    if(!/^\+[1-9]\d{7,15}$/.test(phone)) throw new Error("INVALID_ADDRESS");
    return phone;
  }
  if(channel==="webhook"){
    const u=new URL(value);
    if(!["http:","https:"].includes(u.protocol)) throw new Error("INVALID_ADDRESS");
    if(WEBHOOK_ALLOWLIST.length && !WEBHOOK_ALLOWLIST.includes(u.hostname.toLowerCase())) throw new Error("WEBHOOK_NOT_ALLOWED");
    return u.toString();
  }
  if(channel==="in_app") return value || "in_app";
  throw new Error("INVALID_CHANNEL");
}

function variables(body){
  const value=body?.variables??{};
  if(typeof value!=="object" || Array.isArray(value)) throw new Error("INVALID_VARIABLES");
  const entries=Object.entries(value);
  if(entries.length>40) throw new Error("TOO_MANY_VARIABLES");
  const out={};
  for(const [k,v] of entries){
    if(!/^[A-Za-z0-9_.-]{1,64}$/.test(k)) throw new Error("INVALID_VARIABLE_NAME");
    if(!["string","number","boolean"].includes(typeof v) && v!==null) throw new Error("INVALID_VARIABLE_VALUE");
    out[k]=typeof v==="string"?v.slice(0,2000):String(v??"");
  }
  return out;
}
function render(template,vars){
  return String(template??"").replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g,(_m,key)=>String(vars[key]??""));
}

function audit(action,target,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,target_ref,outcome,detail_json) VALUES(?,?,?,?)")
    .run(action,target??null,outcome,JSON.stringify(detail));
}

function preferenceEnabled(recipient,channel){
  const row=db.prepare("SELECT enabled FROM preferences WHERE recipient_ref=? AND channel=?").get(recipient,channel);
  return row==null || Boolean(row.enabled);
}
function destination(recipient,channel){
  if(channel==="in_app") return recipient;
  const row=db.prepare("SELECT * FROM recipient_channels WHERE recipient_ref=? AND channel=?").get(recipient,channel);
  if(!row) return null;
  return {address:decrypt(row.address_encrypted),hash:row.address_hash};
}
function suppressed(channel,addressHash){
  return Boolean(db.prepare("SELECT 1 AS ok FROM suppressions WHERE channel=? AND address_hash=?").get(channel,addressHash));
}

async function queueRequest(path,body){
  if(!QUEUE_KEY) throw new Error("QUEUE_NOT_CONFIGURED");
  const response=await fetch(QUEUE_URL+path,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":QUEUE_KEY},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(5000)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload?.error||"QUEUE_ERROR");
  return payload;
}

async function enqueueMessage(message){
  return queueRequest("/v1/queues/notify/jobs",{
    uniqueKey:"notify:"+message.id,
    runAt:message.scheduled_at,
    maxAttempts:message.max_attempts,
    payload:{messageId:message.id}
  });
}

function adapterFor(channel,address){
  if(channel==="webhook") return address;
  if(channel==="email") return EMAIL_ADAPTER;
  if(channel==="sms") return SMS_ADAPTER;
  if(channel==="whatsapp") return WHATSAPP_ADAPTER;
  return "";
}

async function deliverExternal(message,to){
  const url=adapterFor(message.channel,to);
  if(!url) throw new Error("ADAPTER_NOT_CONFIGURED");
  const response=await fetch(url,{
    method:"POST",
    headers:{
      "content-type":"application/json",
      ...(ADAPTER_KEY?{"x-izakhono-adapter-key":ADAPTER_KEY}:{})
    },
    body:JSON.stringify({
      messageId:message.id,
      recipientRef:message.recipient_ref,
      channel:message.channel,
      to,
      subject:message.subject,
      body:message.body,
      payload:JSON.parse(message.payload_json)
    }),
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok) throw new Error("ADAPTER_HTTP_"+response.status);
  return response.status;
}

async function deliverJob(job){
  const messageId=job?.payload_json?JSON.parse(job.payload_json).messageId:job?.payload?.messageId;
  if(!messageId) throw new Error("MESSAGE_ID_MISSING");
  const message=db.prepare("SELECT * FROM messages WHERE id=?").get(messageId);
  if(!message) throw new Error("MESSAGE_NOT_FOUND");
  if(["delivered","suppressed","cancelled"].includes(message.state)) return {message,alreadyFinal:true};

  const attempt=Number(job.attempts||1);
  db.prepare("UPDATE messages SET state='delivering',attempts=?,updated_at=datetime('now') WHERE id=?").run(attempt,message.id);

  try{
    let responseCode=200;
    if(message.channel==="in_app"){
      db.prepare(`
        INSERT OR IGNORE INTO inbox(id,recipient_ref,message_id,subject,body)
        VALUES(?,?,?,?,?)
      `).run(randomUUID(),message.recipient_ref,message.id,message.subject,message.body);
    }else{
      const dest=destination(message.recipient_ref,message.channel);
      if(!dest) throw new Error("DESTINATION_NOT_CONFIGURED");
      if(suppressed(message.channel,dest.hash)) throw new Error("DESTINATION_SUPPRESSED");
      responseCode=await deliverExternal(message,dest.address);
    }

    db.prepare("UPDATE messages SET state='delivered',delivered_at=datetime('now'),last_error=NULL,updated_at=datetime('now') WHERE id=?").run(message.id);
    db.prepare("INSERT INTO delivery_attempts(message_id,attempt,channel,outcome,response_code) VALUES(?,?,?,'success',?)")
      .run(message.id,attempt,message.channel,responseCode);
    audit("message.deliver",message.id,"success",{channel:message.channel,attempt});
    return {messageId:message.id,delivered:true};
  }catch(error){
    const err=error instanceof Error?error.message:"DELIVERY_FAILED";
    db.prepare("INSERT INTO delivery_attempts(message_id,attempt,channel,outcome,error) VALUES(?,?,?,'failed',?)")
      .run(message.id,attempt,message.channel,err.slice(0,1000));
    db.prepare("UPDATE messages SET state='retrying',last_error=?,updated_at=datetime('now') WHERE id=?").run(err.slice(0,1000),message.id);
    audit("message.deliver",message.id,"failed",{channel:message.channel,attempt,error:err});
    throw error;
  }
}

async function workOnce(){
  if(workerBusy || !QUEUE_KEY) return;
  workerBusy=true;
  try{
    const leased=await queueRequest("/v1/queues/notify/lease",{worker:WORKER_ID,leaseSeconds:30});
    const job=leased.job;
    if(!job) return;
    try{
      await deliverJob(job);
      await queueRequest("/v1/jobs/"+encodeURIComponent(job.id)+"/ack",{worker:WORKER_ID});
    }catch(error){
      const delay=Math.min(300,RETRY_BASE*Math.max(1,2**Math.max(0,Number(job.attempts||1)-1)));
      const failed=await queueRequest("/v1/jobs/"+encodeURIComponent(job.id)+"/fail",{
        worker:WORKER_ID,error:error instanceof Error?error.message:"DELIVERY_FAILED",retryDelaySeconds:delay
      });
      const payload=failed.job;
      if(payload?.state==="dead"){
        const messageId=JSON.parse(job.payload_json).messageId;
        db.prepare("UPDATE messages SET state='dead',last_error=?,updated_at=datetime('now') WHERE id=?")
          .run(String(error instanceof Error?error.message:"DELIVERY_FAILED").slice(0,1000),messageId);
      }
    }
  }catch(error){
    if(!(error instanceof Error && ["QUEUE_NOT_CONFIGURED","No job"].includes(error.message))) console.error("notify worker",error);
  }finally{
    workerBusy=false;
  }
}
setInterval(workOnce,POLL_MS).unref();

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      let queueReachable=false;
      try{
        if(QUEUE_KEY){
          const r=await fetch(QUEUE_URL+"/health",{signal:AbortSignal.timeout(1500)});
          queueReachable=r.ok;
        }
      }catch{}
      return json(res,200,{
        product:"IZAKHONO NOTIFY NODE",
        status:"healthy",
        queueConfigured:Boolean(QUEUE_KEY),
        queueReachable,
        queued:Number(db.prepare("SELECT count(*) AS count FROM messages WHERE state IN ('queued','retrying')").get()?.count||0),
        delivered:Number(db.prepare("SELECT count(*) AS count FROM messages WHERE state='delivered'").get()?.count||0),
        thirdPartyNotificationControlRequired:false
      });
    }

    if(!authenticated(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/templates"){
      const body=await readJson(req);
      if(!validChannel(body?.channel)) return json(res,400,{error:"Invalid channel"});
      const name=String(body?.name||"").trim();
      if(!/^[A-Za-z0-9_.:-]{2,100}$/.test(name)) return json(res,400,{error:"Invalid template name"});
      if(typeof body?.body!=="string" || !body.body.trim() || body.body.length>20000) return json(res,400,{error:"Invalid body"});
      const id=randomUUID();
      db.prepare("INSERT INTO templates(id,name,channel,subject,body) VALUES(?,?,?,?,?)")
        .run(id,name,body.channel,typeof body.subject==="string"?body.subject.slice(0,500):null,body.body);
      audit("template.create",id,"success",{channel:body.channel});
      return json(res,201,{template:{id,name,channel:body.channel}});
    }

    const channelsMatch=url.pathname.match(/^\/v1\/recipients\/([^/]+)\/channels$/);
    if(req.method==="POST" && channelsMatch){
      const recipient=decodeURIComponent(channelsMatch[1]);
      if(!validRecipientRef(recipient)) return json(res,400,{error:"Invalid recipient"});
      const body=await readJson(req);
      if(!validChannel(body?.channel)) return json(res,400,{error:"Invalid channel"});
      const address=normalizeAddress(body.channel,body.address??recipient);
      db.prepare(`
        INSERT INTO recipient_channels(recipient_ref,channel,address_encrypted,address_hash)
        VALUES(?,?,?,?)
        ON CONFLICT(recipient_ref,channel) DO UPDATE SET
          address_encrypted=excluded.address_encrypted,address_hash=excluded.address_hash,updated_at=datetime('now')
      `).run(recipient,body.channel,encrypt(address),hashAddress(body.channel,address));
      audit("recipient.channel.upsert",recipient,"success",{channel:body.channel});
      return json(res,200,{recipientRef:recipient,channel:body.channel,configured:true});
    }

    const prefMatch=url.pathname.match(/^\/v1\/recipients\/([^/]+)\/preferences$/);
    if(req.method==="POST" && prefMatch){
      const recipient=decodeURIComponent(prefMatch[1]);
      if(!validRecipientRef(recipient)) return json(res,400,{error:"Invalid recipient"});
      const body=await readJson(req);
      if(!validChannel(body?.channel) || typeof body?.enabled!=="boolean") return json(res,400,{error:"Invalid preference"});
      db.prepare(`
        INSERT INTO preferences(recipient_ref,channel,enabled) VALUES(?,?,?)
        ON CONFLICT(recipient_ref,channel) DO UPDATE SET enabled=excluded.enabled,updated_at=datetime('now')
      `).run(recipient,body.channel,body.enabled?1:0);
      audit("recipient.preference",recipient,"success",{channel:body.channel,enabled:body.enabled});
      return json(res,200,{recipientRef:recipient,channel:body.channel,enabled:body.enabled});
    }

    if(req.method==="POST" && url.pathname==="/v1/suppressions"){
      const body=await readJson(req);
      if(!validChannel(body?.channel) || body.channel==="in_app") return json(res,400,{error:"Invalid suppression channel"});
      const address=normalizeAddress(body.channel,body.address);
      db.prepare("INSERT OR REPLACE INTO suppressions(channel,address_hash,reason) VALUES(?,?,?)")
        .run(body.channel,hashAddress(body.channel,address),String(body?.reason||"").slice(0,500));
      audit("suppression.add",body.channel,"success",{});
      return json(res,201,{suppressed:true,channel:body.channel});
    }

    if(req.method==="POST" && url.pathname==="/v1/send"){
      if(!QUEUE_KEY) return json(res,503,{error:"QUEUE NODE is not configured"});
      const body=await readJson(req);
      const recipient=String(body?.recipientRef||"");
      if(!validRecipientRef(recipient) || !validChannel(body?.channel)) return json(res,400,{error:"Invalid recipient or channel"});
      const template=db.prepare("SELECT * FROM templates WHERE id=? OR name=?").get(body?.templateId,body?.templateId);
      if(!template || template.channel!==body.channel) return json(res,404,{error:"Template not found for channel"});
      const vars=variables(body);
      const scheduled=new Date(body?.scheduledAt||Date.now());
      if(Number.isNaN(scheduled.getTime())) return json(res,400,{error:"Invalid scheduledAt"});
      const maxAttempts=Math.min(20,Math.max(1,Number(body?.maxAttempts||5)));
      const idem=typeof body?.idempotencyKey==="string" && body.idempotencyKey.trim()?body.idempotencyKey.trim().slice(0,200):null;
      if(idem){
        const existing=db.prepare("SELECT * FROM messages WHERE idempotency_key=?").get(idem);
        if(existing) return json(res,200,{message:existing,idempotent:true});
      }

      let state="queued";
      if(!preferenceEnabled(recipient,body.channel)) state="suppressed";
      const dest=destination(recipient,body.channel);
      if(body.channel!=="in_app" && !dest) return json(res,409,{error:"Recipient channel is not configured"});
      if(dest && suppressed(body.channel,dest.hash)) state="suppressed";

      const id=randomUUID();
      const subject=render(template.subject,vars).slice(0,500);
      const text=render(template.body,vars).slice(0,20000);
      db.prepare(`
        INSERT INTO messages(id,recipient_ref,channel,template_id,subject,body,payload_json,state,idempotency_key,scheduled_at,max_attempts)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
      `).run(id,recipient,body.channel,template.id,subject||null,text,JSON.stringify(body?.payload??{}),state,idem,scheduled.toISOString(),maxAttempts);

      const message=db.prepare("SELECT * FROM messages WHERE id=?").get(id);
      audit("message.create",id,"success",{channel:body.channel,state});
      if(state==="queued") await enqueueMessage(message);
      return json(res,201,{message,idempotent:false});
    }

    const messageMatch=url.pathname.match(/^\/v1\/messages\/([^/]+)$/);
    if(req.method==="GET" && messageMatch){
      const message=db.prepare("SELECT * FROM messages WHERE id=?").get(messageMatch[1]);
      if(!message) return json(res,404,{error:"Message not found"});
      return json(res,200,{message});
    }

    const inboxMatch=url.pathname.match(/^\/v1\/inbox\/([^/]+)$/);
    if(req.method==="GET" && inboxMatch){
      const recipient=decodeURIComponent(inboxMatch[1]);
      if(!validRecipientRef(recipient)) return json(res,400,{error:"Invalid recipient"});
      const items=db.prepare("SELECT id,message_id,subject,body,created_at,read_at FROM inbox WHERE recipient_ref=? ORDER BY created_at DESC LIMIT 200").all(recipient);
      return json(res,200,{recipientRef:recipient,items});
    }

    const readMatch=url.pathname.match(/^\/v1\/inbox\/([^/]+)\/([^/]+)\/read$/);
    if(req.method==="POST" && readMatch){
      const recipient=decodeURIComponent(readMatch[1]);
      const id=readMatch[2];
      const result=db.prepare("UPDATE inbox SET read_at=datetime('now') WHERE id=? AND recipient_ref=?").run(id,recipient);
      return json(res,Number(result.changes||0)?200:404,{read:Number(result.changes||0)>0});
    }

    if(req.method==="GET" && url.pathname==="/v1/stats"){
      const states=db.prepare("SELECT state,count(*) AS count FROM messages GROUP BY state").all();
      const channels=db.prepare("SELECT channel,count(*) AS count FROM messages GROUP BY channel").all();
      return json(res,200,{states,channels});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(["INVALID_ADDRESS","WEBHOOK_NOT_ALLOWED","INVALID_CHANNEL","INVALID_VARIABLES","TOO_MANY_VARIABLES","INVALID_VARIABLE_NAME","INVALID_VARIABLE_VALUE"].includes(message)){
      return json(res,400,{error:message});
    }
    if(String(error?.message||"").includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO NOTIFY NODE listening on http://${HOST}:${PORT}`);
  if(!SERVICE_KEY) console.warn("WARNING: IZAKHONO_NOTIFY_KEY missing; protected API will reject requests.");
  if(!QUEUE_KEY) console.warn("WARNING: IZAKHONO_QUEUE_KEY missing; delivery worker is disabled.");
});

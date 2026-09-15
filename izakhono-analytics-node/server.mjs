import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8830);
const DB_PATH=resolve(process.env.IZAKHONO_ANALYTICS_DB || "./data/analytics.sqlite");
const ADMIN_KEY=process.env.IZAKHONO_ANALYTICS_ADMIN_KEY || "";
const HASH_KEY=process.env.IZAKHONO_ANALYTICS_HASH_KEY || "";
const COLLECT_LIMIT_PER_MIN=Math.min(5000,Math.max(30,Number(process.env.IZAKHONO_ANALYTICS_COLLECT_LIMIT_PER_MIN || 240)));
const MAX_BODY=Number(process.env.IZAKHONO_ANALYTICS_MAX_BODY_BYTES || 65536);

if(!HASH_KEY) throw new Error("IZAKHONO_ANALYTICS_HASH_KEY is required.");
mkdirSync(dirname(DB_PATH),{recursive:true});

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS sites(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    allowed_origins_json TEXT NOT NULL DEFAULT '[]',
    collect_key_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    visitor_hash TEXT,
    session_hash TEXT,
    path TEXT,
    title TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    country TEXT,
    language TEXT,
    value REAL,
    currency TEXT,
    properties_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS events_site_time_idx ON events(site_id,occurred_at DESC);
  CREATE INDEX IF NOT EXISTS events_site_name_idx ON events(site_id,event_name,occurred_at DESC);
  CREATE INDEX IF NOT EXISTS events_site_visitor_idx ON events(site_id,visitor_hash,occurred_at DESC);
  CREATE INDEX IF NOT EXISTS events_site_session_idx ON events(site_id,session_hash,occurred_at DESC);
  CREATE INDEX IF NOT EXISTS events_site_campaign_idx ON events(site_id,utm_campaign,occurred_at DESC);

  CREATE TABLE IF NOT EXISTS audit_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    site_id TEXT,
    outcome TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );
`);

const buckets=new Map();
const conversionEvents=new Set(["lead","qualified_lead","application","enrolment","order","payment","refund"]);
const forbiddenProperty=/email|phone|password|token|secret|card|address|name/i;

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
function hmac(v){return createHmac("sha256",HASH_KEY).update(v).digest("hex");}
function admin(req){return Boolean(ADMIN_KEY)&&safeEqual(req.headers["x-izakhono-key"],ADMIN_KEY);}
function ip(req){return req.socket.remoteAddress || "unknown";}

function normalizedOrigin(value){
  if(typeof value!=="string" || !value.trim()) return null;
  try{
    const u=new URL(value);
    if(!["http:","https:"].includes(u.protocol)) return null;
    return u.origin.toLowerCase();
  }catch{return null;}
}

function validSiteName(v){return typeof v==="string" && v.trim().length>=2 && v.trim().length<=120;}
function validEventName(v){return typeof v==="string" && /^[a-z][a-z0-9_.:-]{1,79}$/.test(v);}
function cleanString(v,max=500){
  if(v==null) return null;
  if(typeof v!=="string") return null;
  return v.slice(0,max);
}

function allowedOrigins(site){return JSON.parse(site.allowed_origins_json);}
function originAllowed(site,origin){
  const normalized=normalizedOrigin(origin);
  return Boolean(normalized && allowedOrigins(site).includes(normalized));
}

function rateAllowed(req,siteId){
  const key=siteId+"|"+ip(req);
  const now=Date.now();
  const item=buckets.get(key)||{count:0,start:now};
  if(now-item.start>=60000){item.count=0;item.start=now;}
  item.count++;
  buckets.set(key,item);
  return item.count<=COLLECT_LIMIT_PER_MIN;
}
setInterval(()=>{
  const cutoff=Date.now()-5*60000;
  for(const [key,value] of buckets) if(value.start<cutoff) buckets.delete(key);
},60000).unref();

async function readText(req,limit=MAX_BODY){
  let total=0;const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readJson(req,limit=MAX_BODY){
  const text=await readText(req,limit);
  return text?JSON.parse(text):null;
}

function sanitizeProperties(value){
  if(value==null) return {};
  if(typeof value!=="object" || Array.isArray(value)) throw new Error("INVALID_PROPERTIES");
  const entries=Object.entries(value);
  if(entries.length>30) throw new Error("TOO_MANY_PROPERTIES");
  const out={};
  for(const [key,val] of entries){
    if(!/^[A-Za-z0-9_.:-]{1,64}$/.test(key) || forbiddenProperty.test(key)) throw new Error("SENSITIVE_PROPERTY");
    if(["string","number","boolean"].includes(typeof val) || val===null){
      out[key]=typeof val==="string"?val.slice(0,500):val;
    }else{
      throw new Error("INVALID_PROPERTY_VALUE");
    }
  }
  return out;
}

function dateRange(url){
  const now=new Date();
  const toRaw=url.searchParams.get("to");
  const fromRaw=url.searchParams.get("from");
  const to=toRaw?new Date(toRaw):now;
  const from=fromRaw?new Date(fromRaw):new Date(to.getTime()-30*86400000);
  if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||from>to) throw new Error("INVALID_DATE_RANGE");
  if(to.getTime()-from.getTime()>366*86400000) throw new Error("DATE_RANGE_TOO_LARGE");
  return {from:from.toISOString(),to:to.toISOString()};
}

function siteOr404(id){
  return db.prepare("SELECT * FROM sites WHERE id=?").get(id);
}

function trackerSource(){
  return [
    "(function(){",
    "  var s=document.currentScript;",
    "  if(!s)return;",
    "  var site=s.getAttribute('data-site');",
    "  var key=s.getAttribute('data-key');",
    "  if(!site||!key)return;",
    "  var base=new URL(s.src).origin;",
    "  var consent=s.getAttribute('data-consent')==='granted';",
    "  var sentPage=false;",
    "  function id(store,name){var v=store.getItem(name);if(!v){v=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now());store.setItem(name,v);}return v;}",
    "  function payload(name,props){var u=new URL(location.href);return {eventName:name,occurredAt:new Date().toISOString(),visitorId:id(localStorage,'izk_visitor'),sessionId:id(sessionStorage,'izk_session'),path:u.pathname+u.search,title:document.title,referrer:document.referrer||null,utmSource:u.searchParams.get('utm_source'),utmMedium:u.searchParams.get('utm_medium'),utmCampaign:u.searchParams.get('utm_campaign'),utmTerm:u.searchParams.get('utm_term'),utmContent:u.searchParams.get('utm_content'),language:navigator.language||null,properties:props||{}};}",
    "  function send(name,props){if(!consent)return false;var body=JSON.stringify(payload(name,props));var url=base+'/v1/collect?site='+encodeURIComponent(site)+'&key='+encodeURIComponent(key);if(navigator.sendBeacon){return navigator.sendBeacon(url,new Blob([body],{type:'text/plain'}));}fetch(url,{method:'POST',headers:{'content-type':'text/plain'},body:body,keepalive:true,credentials:'omit'}).catch(function(){});return true;}",
    "  function page(){if(sentPage)return;sentPage=true;send('page_view',{});}",
    "  window.izakhonoAnalytics={consent:function(v){consent=!!v;if(consent)page();},track:function(n,p){return send(n,p||{});}};",
    "  if(consent)page();",
    "})();"
  ].join("\n");
}

const insertEvent=db.prepare(`
  INSERT INTO events(
    site_id,event_name,occurred_at,visitor_hash,session_hash,path,title,referrer,
    utm_source,utm_medium,utm_campaign,utm_term,utm_content,country,language,value,currency,properties_json
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO ANALYTICS NODE",
        status:"healthy",
        sites:Number(db.prepare("SELECT count(*) AS count FROM sites").get()?.count||0),
        events:Number(db.prepare("SELECT count(*) AS count FROM events").get()?.count||0),
        storesRawIp:false,
        consentAwareTracker:true,
        thirdPartyAnalyticsRequired:false
      });
    }

    if(req.method==="GET" && url.pathname==="/tracker.js"){
      const source=trackerSource();
      res.writeHead(200,{
        "content-type":"application/javascript; charset=utf-8",
        "content-length":Buffer.byteLength(source),
        "cache-control":"public, max-age=300",
        "x-content-type-options":"nosniff"
      });
      return res.end(source);
    }

    if(req.method==="OPTIONS" && url.pathname==="/v1/collect"){
      const site=siteOr404(url.searchParams.get("site"));
      const origin=req.headers.origin;
      if(!site || !originAllowed(site,origin)) return json(res,403,{error:"Origin not allowed"});
      res.writeHead(204,{
        "access-control-allow-origin":normalizedOrigin(origin),
        "access-control-allow-methods":"POST, OPTIONS",
        "access-control-allow-headers":"content-type",
        "access-control-max-age":"600",
        "vary":"Origin"
      });
      return res.end();
    }

    if(req.method==="POST" && url.pathname==="/v1/collect"){
      const siteId=url.searchParams.get("site");
      const key=url.searchParams.get("key")||"";
      const site=siteOr404(siteId);
      if(!site || !safeEqual(sha256(key),site.collect_key_hash)) return json(res,404,{error:"Unknown site"});
      const origin=req.headers.origin;
      if(!originAllowed(site,origin)) return json(res,403,{error:"Origin not allowed"});
      if(!rateAllowed(req,site.id)) return json(res,429,{error:"Rate limit exceeded"},{"retry-after":"60"});

      const raw=await readText(req);
      const body=raw?JSON.parse(raw):null;
      if(!validEventName(body?.eventName)) return json(res,400,{error:"Invalid event name"});
      const occurred=new Date(body?.occurredAt||Date.now());
      if(Number.isNaN(occurred.getTime())) return json(res,400,{error:"Invalid occurredAt"});
      if(Math.abs(Date.now()-occurred.getTime())>7*86400000) return json(res,400,{error:"Event timestamp outside accepted window"});

      const properties=sanitizeProperties(body?.properties);
      const visitorHash=typeof body?.visitorId==="string" && body.visitorId? hmac(site.id+"|visitor|"+body.visitorId.slice(0,200)) : null;
      const sessionHash=typeof body?.sessionId==="string" && body.sessionId? hmac(site.id+"|session|"+body.sessionId.slice(0,200)) : null;
      const value=typeof body?.value==="number" && Number.isFinite(body.value)?body.value:null;
      const currency=typeof body?.currency==="string" && /^[A-Za-z]{3}$/.test(body.currency)?body.currency.toUpperCase():null;

      insertEvent.run(
        site.id,body.eventName,occurred.toISOString(),visitorHash,sessionHash,
        cleanString(body?.path,1000),cleanString(body?.title,500),cleanString(body?.referrer,1000),
        cleanString(body?.utmSource,200),cleanString(body?.utmMedium,200),cleanString(body?.utmCampaign,300),
        cleanString(body?.utmTerm,300),cleanString(body?.utmContent,300),cleanString(body?.country,100),
        cleanString(body?.language,50),value,currency,JSON.stringify(properties)
      );

      return json(res,202,{accepted:true},{
        "access-control-allow-origin":normalizedOrigin(origin),
        "vary":"Origin"
      });
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/sites"){
      const body=await readJson(req);
      if(!validSiteName(body?.name)) return json(res,400,{error:"Invalid site name"});
      const origins=Array.isArray(body?.allowedOrigins)?[...new Set(body.allowedOrigins.map(normalizedOrigin).filter(Boolean))]:[];
      if(origins.length===0 || origins.length>30) return json(res,400,{error:"At least one valid allowed origin is required"});
      const id=randomUUID();
      const collectKey="iza_"+randomBytes(24).toString("base64url");
      db.prepare("INSERT INTO sites(id,name,allowed_origins_json,collect_key_hash) VALUES(?,?,?,?)")
        .run(id,body.name.trim(),JSON.stringify(origins),sha256(collectKey));
      db.prepare("INSERT INTO audit_ledger(action,site_id,outcome,detail_json) VALUES('site.create',?,'success',?)")
        .run(id,JSON.stringify({origins}));
      return json(res,201,{site:{id,name:body.name.trim(),allowedOrigins:origins},collectKey});
    }

    if(req.method==="GET" && url.pathname==="/v1/sites"){
      const rows=db.prepare("SELECT id,name,allowed_origins_json,created_at,updated_at FROM sites ORDER BY name").all()
        .map(row=>({...row,allowedOrigins:JSON.parse(row.allowed_origins_json),allowed_origins_json:undefined}));
      return json(res,200,{sites:rows});
    }

    const rotate=url.pathname.match(/^\/v1\/sites\/([^/]+)\/rotate-key$/);
    if(req.method==="POST" && rotate){
      const site=siteOr404(rotate[1]);
      if(!site) return json(res,404,{error:"Site not found"});
      const collectKey="iza_"+randomBytes(24).toString("base64url");
      db.prepare("UPDATE sites SET collect_key_hash=?,updated_at=datetime('now') WHERE id=?").run(sha256(collectKey),site.id);
      db.prepare("INSERT INTO audit_ledger(action,site_id,outcome,detail_json) VALUES('site.key.rotate',?,'success','{}')").run(site.id);
      return json(res,200,{siteId:site.id,collectKey});
    }

    const overview=url.pathname.match(/^\/v1\/sites\/([^/]+)\/overview$/);
    if(req.method==="GET" && overview){
      const site=siteOr404(overview[1]); if(!site) return json(res,404,{error:"Site not found"});
      const {from,to}=dateRange(url);
      const row=db.prepare(`
        SELECT
          count(*) AS events,
          sum(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) AS pageviews,
          count(DISTINCT visitor_hash) AS visitors,
          count(DISTINCT session_hash) AS sessions,
          sum(CASE WHEN event_name IN ('lead','qualified_lead','application','enrolment','order','payment') THEN 1 ELSE 0 END) AS conversions,
          coalesce(sum(CASE WHEN event_name='payment' THEN value ELSE 0 END),0) AS gross_revenue,
          coalesce(sum(CASE WHEN event_name='refund' THEN value ELSE 0 END),0) AS refunds
        FROM events WHERE site_id=? AND datetime(occurred_at)>=datetime(?) AND datetime(occurred_at)<=datetime(?)
      `).get(site.id,from,to);
      return json(res,200,{
        site:{id:site.id,name:site.name},from,to,
        events:Number(row.events||0),pageviews:Number(row.pageviews||0),visitors:Number(row.visitors||0),
        sessions:Number(row.sessions||0),conversions:Number(row.conversions||0),
        grossRevenue:Number(row.gross_revenue||0),refunds:Number(row.refunds||0),
        netRevenue:Number(row.gross_revenue||0)-Number(row.refunds||0)
      });
    }

    const top=url.pathname.match(/^\/v1\/sites\/([^/]+)\/top$/);
    if(req.method==="GET" && top){
      const site=siteOr404(top[1]); if(!site) return json(res,404,{error:"Site not found"});
      const {from,to}=dateRange(url);
      const dimension=url.searchParams.get("dimension")||"path";
      const columns={path:"path",source:"utm_source",medium:"utm_medium",campaign:"utm_campaign",referrer:"referrer",country:"country",language:"language",event:"event_name"};
      const column=columns[dimension];
      if(!column) return json(res,400,{error:"Unsupported dimension"});
      const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||20)));
      const rows=db.prepare(`
        SELECT ${column} AS value,count(*) AS count
        FROM events
        WHERE site_id=? AND datetime(occurred_at)>=datetime(?) AND datetime(occurred_at)<=datetime(?)
          AND ${column} IS NOT NULL AND ${column}<>''
        GROUP BY ${column} ORDER BY count DESC LIMIT ?
      `).all(site.id,from,to,limit);
      return json(res,200,{siteId:site.id,from,to,dimension,rows});
    }

    const timeseries=url.pathname.match(/^\/v1\/sites\/([^/]+)\/timeseries$/);
    if(req.method==="GET" && timeseries){
      const site=siteOr404(timeseries[1]); if(!site) return json(res,404,{error:"Site not found"});
      const {from,to}=dateRange(url);
      const unit=url.searchParams.get("unit")==="hour"?"hour":"day";
      const format=unit==="hour"?"%Y-%m-%dT%H:00:00Z":"%Y-%m-%d";
      const rows=db.prepare(`
        SELECT strftime(?,occurred_at) AS bucket,
          count(*) AS events,
          sum(CASE WHEN event_name='page_view' THEN 1 ELSE 0 END) AS pageviews,
          count(DISTINCT visitor_hash) AS visitors,
          coalesce(sum(CASE WHEN event_name='payment' THEN value ELSE 0 END),0) -
          coalesce(sum(CASE WHEN event_name='refund' THEN value ELSE 0 END),0) AS net_revenue
        FROM events WHERE site_id=? AND datetime(occurred_at)>=datetime(?) AND datetime(occurred_at)<=datetime(?)
        GROUP BY bucket ORDER BY bucket
      `).all(format,site.id,from,to);
      return json(res,200,{siteId:site.id,from,to,unit,rows});
    }

    const funnel=url.pathname.match(/^\/v1\/sites\/([^/]+)\/funnel$/);
    if(req.method==="GET" && funnel){
      const site=siteOr404(funnel[1]); if(!site) return json(res,404,{error:"Site not found"});
      const {from,to}=dateRange(url);
      const steps=(url.searchParams.get("steps")||"page_view,lead,payment").split(",").map(x=>x.trim()).filter(validEventName);
      if(steps.length<2 || steps.length>8) return json(res,400,{error:"Funnel requires 2-8 valid event names"});
      const placeholders=steps.map(()=>"?").join(",");
      const rows=db.prepare(`
        SELECT session_hash,event_name,occurred_at,id
        FROM events
        WHERE site_id=? AND datetime(occurred_at)>=datetime(?) AND datetime(occurred_at)<=datetime(?)
          AND session_hash IS NOT NULL AND event_name IN (${placeholders})
        ORDER BY session_hash,datetime(occurred_at),id
      `).all(site.id,from,to,...steps);

      const progress=new Map();
      for(const row of rows){
        const current=progress.get(row.session_hash)||0;
        if(current<steps.length && row.event_name===steps[current]) progress.set(row.session_hash,current+1);
      }
      const counts=steps.map(()=>0);
      for(const n of progress.values()) for(let i=0;i<n;i++) counts[i]++;
      const result=steps.map((step,i)=>({
        step,
        sessions:counts[i],
        fromPrevious:i===0?1:(counts[i-1]?counts[i]/counts[i-1]:0),
        fromStart:counts[0]?counts[i]/counts[0]:0
      }));
      return json(res,200,{siteId:site.id,from,to,steps:result});
    }

    if(req.method==="GET" && url.pathname==="/v1/audit"){
      const limit=Math.min(500,Math.max(1,Number(url.searchParams.get("limit")||100)));
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT ?").all(limit)});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(["INVALID_PROPERTIES","TOO_MANY_PROPERTIES","SENSITIVE_PROPERTY","INVALID_PROPERTY_VALUE","INVALID_DATE_RANGE","DATE_RANGE_TOO_LARGE"].includes(message)){
      return json(res,400,{error:message});
    }
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO ANALYTICS NODE listening on http://${HOST}:${PORT}`);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_ANALYTICS_ADMIN_KEY missing; private reporting/admin API will reject requests.");
});

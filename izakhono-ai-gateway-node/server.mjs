import { createServer } from "node:http";
import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  randomBytes, randomUUID, timingSafeEqual
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8850);
const DB_PATH=resolve(process.env.IZAKHONO_AI_GATEWAY_DB || "./data/ai-gateway.sqlite");
const ADMIN_KEY=process.env.IZAKHONO_AI_GATEWAY_ADMIN_KEY || "";
const ENCRYPTION_RAW=process.env.IZAKHONO_AI_GATEWAY_ENCRYPTION_KEY || "";
const PROVIDER_ALLOWLIST=(process.env.IZAKHONO_AI_PROVIDER_ALLOWLIST || "127.0.0.1,localhost,::1")
  .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
const MAX_BODY=Math.min(10*1024*1024,Math.max(65536,Number(process.env.IZAKHONO_AI_GATEWAY_MAX_BODY_BYTES || 2*1024*1024)));
const DEFAULT_TIMEOUT=Math.min(300000,Math.max(1000,Number(process.env.IZAKHONO_AI_GATEWAY_TIMEOUT_MS || 60000)));
const CIRCUIT_FAILURES=Math.min(20,Math.max(1,Number(process.env.IZAKHONO_AI_CIRCUIT_FAILURES || 3)));
const CIRCUIT_SECONDS=Math.min(3600,Math.max(5,Number(process.env.IZAKHONO_AI_CIRCUIT_SECONDS || 60)));

function encryptionKey(){
  const key=Buffer.from(ENCRYPTION_RAW,"base64");
  if(key.length!==32) throw new Error("IZAKHONO_AI_GATEWAY_ENCRYPTION_KEY must decode to 32 bytes");
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

  CREATE TABLE IF NOT EXISTS providers(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    chat_path TEXT NOT NULL DEFAULT '/v1/chat/completions',
    api_key_encrypted TEXT,
    auth_header TEXT NOT NULL DEFAULT 'authorization',
    auth_scheme TEXT NOT NULL DEFAULT 'Bearer',
    extra_headers_json TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    is_local INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 100,
    timeout_ms INTEGER NOT NULL DEFAULT 60000,
    failure_count INTEGER NOT NULL DEFAULT 0,
    circuit_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS routes(
    alias TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    upstream_model TEXT NOT NULL,
    rank INTEGER NOT NULL DEFAULT 100,
    enabled INTEGER NOT NULL DEFAULT 1,
    max_input_chars INTEGER NOT NULL DEFAULT 200000,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(alias,provider_id,upstream_model),
    FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS routes_alias_rank_idx ON routes(alias,enabled,rank);

  CREATE TABLE IF NOT EXISTS clients(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    allowed_aliases_json TEXT NOT NULL DEFAULT '["*"]',
    daily_requests INTEGER NOT NULL DEFAULT 1000,
    daily_tokens INTEGER NOT NULL DEFAULT 1000000,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_daily(
    day TEXT NOT NULL,
    client_id TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(day,client_id),
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS request_ledger(
    id TEXT PRIMARY KEY,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    client_id TEXT,
    model_alias TEXT,
    provider_id TEXT,
    upstream_model TEXT,
    status TEXT NOT NULL,
    http_status INTEGER,
    latency_ms INTEGER,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    prompt_hash TEXT,
    error TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS request_ledger_time_idx ON request_ledger(occurred_at DESC);
  CREATE INDEX IF NOT EXISTS request_ledger_client_idx ON request_ledger(client_id,occurred_at DESC);
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
  if(aa.length!==bb.length) return false;
  return timingSafeEqual(aa,bb);
}
function sha256(v){return createHash("sha256").update(v).digest("hex");}
function promptHash(v){return createHmac("sha256",encryptionKey()).update(v).digest("hex");}
function admin(req){return Boolean(ADMIN_KEY)&&safeEqual(req.headers["x-izakhono-key"],ADMIN_KEY);}

function encrypt(value){
  if(!value) return null;
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const ct=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:tag.toString("base64"),ct:ct.toString("base64")});
}
function decrypt(value){
  if(!value) return "";
  const e=JSON.parse(value);
  if(e.v!==1) throw new Error("UNSUPPORTED_SECRET_ENVELOPE");
  const d=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(e.iv,"base64"));
  d.setAuthTag(Buffer.from(e.tag,"base64"));
  return Buffer.concat([d.update(Buffer.from(e.ct,"base64")),d.final()]).toString("utf8");
}

async function readJson(req,limit=MAX_BODY){
  let total=0; const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  if(!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validName(v){return typeof v==="string" && /^[a-z0-9][a-z0-9._:-]{1,100}$/.test(v);}
function validHeaderName(v){return typeof v==="string" && /^[a-z0-9-]{1,80}$/i.test(v);}

function validateBaseUrl(value,isLocal){
  let u;
  try{u=new URL(value);}catch{throw new Error("INVALID_PROVIDER_URL");}
  if(u.username || u.password || u.search || u.hash) throw new Error("INVALID_PROVIDER_URL");
  if(!["http:","https:"].includes(u.protocol)) throw new Error("INVALID_PROVIDER_URL");
  const host=u.hostname.toLowerCase();
  if(!PROVIDER_ALLOWLIST.includes(host)) throw new Error("PROVIDER_HOST_NOT_ALLOWED");
  if(!isLocal && u.protocol!=="https:") throw new Error("EXTERNAL_PROVIDER_REQUIRES_HTTPS");
  return u.origin + u.pathname.replace(/\/$/,"");
}
function safeChatPath(v){
  const value=typeof v==="string"?v:"/v1/chat/completions";
  if(!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(value) || value.includes("..")) throw new Error("INVALID_CHAT_PATH");
  return value;
}
function safeHeaders(v){
  if(v==null) return {};
  if(typeof v!=="object" || Array.isArray(v)) throw new Error("INVALID_HEADERS");
  const out={};
  for(const [k,val] of Object.entries(v)){
    if(!validHeaderName(k) || ["host","content-length","authorization"].includes(k.toLowerCase())) throw new Error("INVALID_HEADERS");
    if(typeof val!=="string" || val.length>1000) throw new Error("INVALID_HEADERS");
    out[k]=val;
  }
  return out;
}

function clientFromRequest(req){
  const auth=String(req.headers.authorization||"");
  const raw=auth.startsWith("Bearer ")?auth.slice(7).trim():String(req.headers["x-api-key"]||"");
  if(!raw) return null;
  return db.prepare("SELECT * FROM clients WHERE key_hash=? AND enabled=1").get(sha256(raw)) || null;
}
function aliasesForClient(client){return JSON.parse(client.allowed_aliases_json);}
function aliasAllowed(client,alias){
  const allowed=aliasesForClient(client);
  return allowed.includes("*") || allowed.includes(alias);
}
function dayUtc(){return new Date().toISOString().slice(0,10);}
function usage(clientId){
  return db.prepare("SELECT * FROM usage_daily WHERE day=? AND client_id=?").get(dayUtc(),clientId) ||
    {day:dayUtc(),client_id:clientId,requests:0,input_tokens:0,output_tokens:0};
}
function checkQuota(client,estimatedInputTokens){
  const u=usage(client.id);
  if(Number(u.requests)>=Number(client.daily_requests)) throw new Error("REQUEST_QUOTA_EXCEEDED");
  if(Number(u.input_tokens)+Number(u.output_tokens)+estimatedInputTokens>Number(client.daily_tokens)) throw new Error("TOKEN_QUOTA_EXCEEDED");
}
function addUsage(clientId,inputTokens,outputTokens){
  db.prepare(`
    INSERT INTO usage_daily(day,client_id,requests,input_tokens,output_tokens)
    VALUES(?,?,1,?,?)
    ON CONFLICT(day,client_id) DO UPDATE SET
      requests=requests+1,
      input_tokens=input_tokens+excluded.input_tokens,
      output_tokens=output_tokens+excluded.output_tokens
  `).run(dayUtc(),clientId,inputTokens,outputTokens);
}

function normalizeMessages(messages){
  if(!Array.isArray(messages) || messages.length<1 || messages.length>200) throw new Error("INVALID_MESSAGES");
  const out=[];
  let chars=0;
  for(const item of messages){
    if(!item || typeof item!=="object") throw new Error("INVALID_MESSAGES");
    if(!["system","developer","user","assistant","tool"].includes(item.role)) throw new Error("INVALID_MESSAGES");
    if(typeof item.content!=="string") throw new Error("STRING_CONTENT_ONLY");
    const content=item.content;
    chars+=content.length;
    out.push({role:item.role,content});
  }
  return {messages:out,chars,text:out.map(x=>x.role+":"+x.content).join("\n")};
}
function estimateTokens(chars){return Math.max(1,Math.ceil(chars/4));}
function extractOutputText(payload){
  if(!payload || typeof payload!=="object") return "";
  const choices=Array.isArray(payload.choices)?payload.choices:[];
  return choices.map(c=>typeof c?.message?.content==="string"?c.message.content:"").join("\n");
}
function usageFromPayload(payload,inputEstimate){
  const u=payload?.usage || {};
  const input=Number(u.prompt_tokens ?? u.input_tokens ?? inputEstimate);
  const output=Number(u.completion_tokens ?? u.output_tokens ?? estimateTokens(extractOutputText(payload).length));
  return {
    input:Number.isFinite(input)?Math.max(0,Math.round(input)):inputEstimate,
    output:Number.isFinite(output)?Math.max(0,Math.round(output)):0
  };
}

function routesForAlias(alias){
  return db.prepare(`
    SELECT r.*,p.name AS provider_name,p.base_url,p.chat_path,p.api_key_encrypted,
           p.auth_header,p.auth_scheme,p.extra_headers_json,p.enabled AS provider_enabled,
           p.is_local,p.priority,p.timeout_ms,p.failure_count,p.circuit_until
    FROM routes r JOIN providers p ON p.id=r.provider_id
    WHERE r.alias=? AND r.enabled=1 AND p.enabled=1
    ORDER BY r.rank ASC,p.priority ASC
  `).all(alias);
}
function circuitOpen(route){
  return Boolean(route.circuit_until && new Date(route.circuit_until).getTime()>Date.now());
}
function providerSuccess(providerId){
  db.prepare("UPDATE providers SET failure_count=0,circuit_until=NULL,updated_at=datetime('now') WHERE id=?").run(providerId);
}
function providerFailure(providerId){
  const p=db.prepare("SELECT failure_count FROM providers WHERE id=?").get(providerId);
  const count=Number(p?.failure_count||0)+1;
  if(count>=CIRCUIT_FAILURES){
    db.prepare("UPDATE providers SET failure_count=?,circuit_until=datetime('now',?),updated_at=datetime('now') WHERE id=?")
      .run(0,"+"+CIRCUIT_SECONDS+" seconds",providerId);
  }else{
    db.prepare("UPDATE providers SET failure_count=?,updated_at=datetime('now') WHERE id=?").run(count,providerId);
  }
}
function ledger(entry){
  db.prepare(`
    INSERT INTO request_ledger(id,client_id,model_alias,provider_id,upstream_model,status,http_status,latency_ms,input_tokens,output_tokens,prompt_hash,error)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    entry.id,entry.clientId??null,entry.alias??null,entry.providerId??null,entry.upstreamModel??null,
    entry.status,entry.httpStatus??null,entry.latencyMs??null,entry.inputTokens||0,entry.outputTokens||0,
    entry.promptHash??null,entry.error?String(entry.error).slice(0,2000):null
  );
}

async function callRoute(route,body,inputEstimate){
  const started=Date.now();
  const headers={"content-type":"application/json","accept":"application/json",...JSON.parse(route.extra_headers_json||"{}")};
  const secret=decrypt(route.api_key_encrypted);
  if(secret){
    const header=String(route.auth_header||"authorization").toLowerCase();
    headers[header]=route.auth_scheme ? String(route.auth_scheme)+" "+secret : secret;
  }
  const target=route.base_url.replace(/\/$/,"")+route.chat_path;
  const response=await fetch(target,{
    method:"POST",
    headers,
    body:JSON.stringify({...body,model:route.upstream_model,stream:false}),
    signal:AbortSignal.timeout(Math.min(300000,Math.max(1000,Number(route.timeout_ms||DEFAULT_TIMEOUT))))
  });
  const text=await response.text();
  let payload;
  try{payload=JSON.parse(text);}catch{payload={error:{message:"Provider returned non-JSON response"}};}
  const latencyMs=Date.now()-started;
  if(!response.ok) {
    const err=new Error(payload?.error?.message || "PROVIDER_HTTP_"+response.status);
    err.httpStatus=response.status;
    err.latencyMs=latencyMs;
    throw err;
  }
  const tokens=usageFromPayload(payload,inputEstimate);
  return {payload,latencyMs,tokens,httpStatus:response.status};
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO AI GATEWAY NODE",
        status:"healthy",
        providers:Number(db.prepare("SELECT count(*) AS count FROM providers WHERE enabled=1").get()?.count||0),
        modelAliases:Number(db.prepare("SELECT count(DISTINCT alias) AS count FROM routes WHERE enabled=1").get()?.count||0),
        clients:Number(db.prepare("SELECT count(*) AS count FROM clients WHERE enabled=1").get()?.count||0),
        promptsPersisted:false,
        localModelCompatible:true,
        externalProviderRequired:false
      });
    }

    if(req.method==="POST" && url.pathname==="/v1/chat/completions"){
      const client=clientFromRequest(req);
      if(!client) return json(res,401,{error:{message:"Invalid client key",type:"authentication_error"}});
      const body=await readJson(req);
      const alias=String(body?.model||"");
      if(!validName(alias) || !aliasAllowed(client,alias)) return json(res,403,{error:{message:"Model alias not allowed",type:"authorization_error"}});
      if(body?.stream===true) return json(res,400,{error:{message:"Streaming is not enabled in V1",type:"unsupported_feature"}});
      const normalized=normalizeMessages(body?.messages);
      const inputEstimate=estimateTokens(normalized.chars);
      try{checkQuota(client,inputEstimate);}catch(error){
        const code=error.message;
        return json(res,429,{error:{message:code,type:"quota_error"}},{"retry-after":"86400"});
      }
      const routes=routesForAlias(alias).filter(r=>!circuitOpen(r) && normalized.chars<=Number(r.max_input_chars));
      if(!routes.length) return json(res,503,{error:{message:"No healthy route available",type:"gateway_unavailable"}});

      const requestId="iza_ai_"+randomUUID();
      const pHash=promptHash(normalized.text);
      let lastError=null;

      for(const route of routes){
        const cleanBody={
          messages:normalized.messages,
          ...(typeof body.temperature==="number"?{temperature:body.temperature}:{}),
          ...(Number.isInteger(body.max_tokens)?{max_tokens:body.max_tokens}:{}),
          ...(Number.isInteger(body.max_completion_tokens)?{max_completion_tokens:body.max_completion_tokens}:{}),
          ...(typeof body.top_p==="number"?{top_p:body.top_p}:{})
        };
        try{
          const result=await callRoute(route,cleanBody,inputEstimate);
          providerSuccess(route.provider_id);
          addUsage(client.id,result.tokens.input,result.tokens.output);
          ledger({
            id:requestId,clientId:client.id,alias,providerId:route.provider_id,upstreamModel:route.upstream_model,
            status:"success",httpStatus:result.httpStatus,latencyMs:result.latencyMs,
            inputTokens:result.tokens.input,outputTokens:result.tokens.output,promptHash:pHash
          });
          const payload={
            ...result.payload,
            id:result.payload?.id || requestId,
            model:alias,
            usage:result.payload?.usage || {
              prompt_tokens:result.tokens.input,
              completion_tokens:result.tokens.output,
              total_tokens:result.tokens.input+result.tokens.output
            },
            x_izakhono:{
              gateway:"IZAKHONO AI GATEWAY NODE",
              provider:route.provider_name,
              upstreamModel:route.upstream_model,
              requestId
            }
          };
          return json(res,200,payload,{"x-izakhono-ai-request":requestId});
        }catch(error){
          providerFailure(route.provider_id);
          lastError=error;
          ledger({
            id:"iza_ai_"+randomUUID(),clientId:client.id,alias,providerId:route.provider_id,upstreamModel:route.upstream_model,
            status:"failed",httpStatus:error.httpStatus||502,latencyMs:error.latencyMs||0,
            inputTokens:inputEstimate,outputTokens:0,promptHash:pHash,error:error.message
          });
        }
      }

      return json(res,502,{error:{message:"All model routes failed",type:"gateway_error",detail:lastError?.message||"unknown"}});
    }

    if(!admin(req)) return json(res,401,{error:"Unauthorized"});

    if(req.method==="POST" && url.pathname==="/v1/admin/providers"){
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!validName(name)) return json(res,400,{error:"Invalid provider name"});
      const isLocal=Boolean(body?.isLocal);
      const baseUrl=validateBaseUrl(body?.baseUrl,isLocal);
      const chatPath=safeChatPath(body?.chatPath);
      const authHeader=String(body?.authHeader||"authorization").toLowerCase();
      if(!validHeaderName(authHeader)) return json(res,400,{error:"Invalid auth header"});
      const authScheme=String(body?.authScheme??"Bearer").slice(0,40);
      const headers=safeHeaders(body?.extraHeaders);
      const id=body?.id && validName(body.id)?body.id:randomUUID();
      const existing=db.prepare("SELECT * FROM providers WHERE name=?").get(name);
      const encrypted=body?.apiKey!=null?encrypt(String(body.apiKey)):existing?.api_key_encrypted??null;
      if(existing){
        db.prepare(`
          UPDATE providers SET base_url=?,chat_path=?,api_key_encrypted=?,auth_header=?,auth_scheme=?,
            extra_headers_json=?,enabled=?,is_local=?,priority=?,timeout_ms=?,updated_at=datetime('now')
          WHERE id=?
        `).run(
          baseUrl,chatPath,encrypted,authHeader,authScheme,JSON.stringify(headers),
          body?.enabled===false?0:1,isLocal?1:0,Number(body?.priority||100),
          Math.min(300000,Math.max(1000,Number(body?.timeoutMs||DEFAULT_TIMEOUT))),existing.id
        );
        return json(res,200,{provider:{id:existing.id,name,baseUrl,chatPath,isLocal,secretConfigured:Boolean(encrypted)}});
      }
      db.prepare(`
        INSERT INTO providers(id,name,base_url,chat_path,api_key_encrypted,auth_header,auth_scheme,extra_headers_json,enabled,is_local,priority,timeout_ms)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        id,name,baseUrl,chatPath,encrypted,authHeader,authScheme,JSON.stringify(headers),
        body?.enabled===false?0:1,isLocal?1:0,Number(body?.priority||100),
        Math.min(300000,Math.max(1000,Number(body?.timeoutMs||DEFAULT_TIMEOUT)))
      );
      return json(res,201,{provider:{id,name,baseUrl,chatPath,isLocal,secretConfigured:Boolean(encrypted)}});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/providers"){
      const rows=db.prepare(`
        SELECT id,name,base_url,chat_path,auth_header,auth_scheme,enabled,is_local,priority,timeout_ms,
               failure_count,circuit_until,created_at,updated_at,
               CASE WHEN api_key_encrypted IS NULL THEN 0 ELSE 1 END AS secret_configured
        FROM providers ORDER BY priority,name
      `).all();
      return json(res,200,{providers:rows});
    }

    if(req.method==="POST" && url.pathname==="/v1/admin/routes"){
      const body=await readJson(req);
      const alias=String(body?.alias||"").trim().toLowerCase();
      const providerId=String(body?.providerId||"");
      const upstreamModel=String(body?.upstreamModel||"").trim();
      if(!validName(alias) || !providerId || !upstreamModel || upstreamModel.length>200) return json(res,400,{error:"Invalid route"});
      if(!db.prepare("SELECT 1 AS ok FROM providers WHERE id=?").get(providerId)) return json(res,404,{error:"Provider not found"});
      db.prepare(`
        INSERT INTO routes(alias,provider_id,upstream_model,rank,enabled,max_input_chars)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(alias,provider_id,upstream_model) DO UPDATE SET
          rank=excluded.rank,enabled=excluded.enabled,max_input_chars=excluded.max_input_chars,updated_at=datetime('now')
      `).run(alias,providerId,upstreamModel,Number(body?.rank||100),body?.enabled===false?0:1,Math.min(2000000,Math.max(1000,Number(body?.maxInputChars||200000))));
      return json(res,201,{route:{alias,providerId,upstreamModel}});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/routes"){
      return json(res,200,{routes:db.prepare(`
        SELECT r.*,p.name AS provider_name FROM routes r JOIN providers p ON p.id=r.provider_id ORDER BY alias,rank
      `).all()});
    }

    if(req.method==="POST" && url.pathname==="/v1/admin/clients"){
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!validName(name)) return json(res,400,{error:"Invalid client name"});
      const aliases=Array.isArray(body?.allowedAliases)?body.allowedAliases.map(String).filter(x=>x==="*"||validName(x)).slice(0,100):["*"];
      if(!aliases.length) return json(res,400,{error:"At least one alias is required"});
      const raw="iza_ai_"+randomBytes(32).toString("base64url");
      const id=randomUUID();
      db.prepare(`
        INSERT INTO clients(id,name,key_hash,prefix,allowed_aliases_json,daily_requests,daily_tokens)
        VALUES(?,?,?,?,?,?,?)
      `).run(
        id,name,sha256(raw),raw.slice(0,14),JSON.stringify([...new Set(aliases)]),
        Math.min(1000000,Math.max(1,Number(body?.dailyRequests||1000))),
        Math.min(1000000000,Math.max(100,Number(body?.dailyTokens||1000000)))
      );
      return json(res,201,{client:{id,name,allowedAliases:aliases},apiKey:raw});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/clients"){
      return json(res,200,{clients:db.prepare(`
        SELECT id,name,prefix,enabled,allowed_aliases_json,daily_requests,daily_tokens,created_at,updated_at FROM clients ORDER BY name
      `).all()});
    }

    const rotateClient=url.pathname.match(/^\/v1\/admin\/clients\/([^/]+)\/rotate-key$/);
    if(req.method==="POST" && rotateClient){
      const id=decodeURIComponent(rotateClient[1]);
      const client=db.prepare("SELECT id,name FROM clients WHERE id=?").get(id);
      if(!client) return json(res,404,{error:"Client not found"});
      const raw="iza_ai_"+randomBytes(32).toString("base64url");
      db.prepare("UPDATE clients SET key_hash=?,prefix=?,updated_at=datetime('now') WHERE id=?")
        .run(sha256(raw),raw.slice(0,14),id);
      return json(res,200,{client:{id:client.id,name:client.name},apiKey:raw});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/usage"){
      const day=url.searchParams.get("day")||dayUtc();
      const rows=db.prepare(`
        SELECT u.*,c.name AS client_name FROM usage_daily u JOIN clients c ON c.id=u.client_id
        WHERE u.day=? ORDER BY u.requests DESC
      `).all(day);
      return json(res,200,{day,usage:rows});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/requests"){
      const limit=Math.min(500,Math.max(1,Number(url.searchParams.get("limit")||100)));
      return json(res,200,{requests:db.prepare("SELECT * FROM request_ledger ORDER BY occurred_at DESC LIMIT ?").all(limit)});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(["INVALID_PROVIDER_URL","PROVIDER_HOST_NOT_ALLOWED","EXTERNAL_PROVIDER_REQUIRES_HTTPS","INVALID_CHAT_PATH","INVALID_HEADERS"].includes(message)){
      return json(res,400,{error:message});
    }
    if(String(error?.message||"").includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO AI GATEWAY NODE listening on http://${HOST}:${PORT}`);
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_AI_GATEWAY_ADMIN_KEY missing; admin API will reject requests.");
});

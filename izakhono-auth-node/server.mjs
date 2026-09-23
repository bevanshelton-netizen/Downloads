import { createServer } from "node:http";
import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  randomBytes, randomUUID, scryptSync, timingSafeEqual
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8820);
const DB_PATH=resolve(process.env.IZAKHONO_AUTH_DB || "./data/auth.sqlite");
const BOOTSTRAP_KEY=process.env.IZAKHONO_AUTH_BOOTSTRAP_KEY || "";
const ENCRYPTION_KEY_RAW=process.env.IZAKHONO_AUTH_ENCRYPTION_KEY || "";
const SESSION_HOURS=Math.min(168,Math.max(1,Number(process.env.IZAKHONO_AUTH_SESSION_HOURS || 12)));
const COOKIE_DOMAIN=process.env.IZAKHONO_AUTH_COOKIE_DOMAIN || "";
const LOGIN_LIMIT_PER_MIN=Math.min(100,Math.max(3,Number(process.env.IZAKHONO_AUTH_LOGIN_LIMIT_PER_MIN || 12)));
const LOCK_AFTER=Math.min(20,Math.max(3,Number(process.env.IZAKHONO_AUTH_LOCK_AFTER || 5)));
const LOCK_MINUTES=Math.min(1440,Math.max(1,Number(process.env.IZAKHONO_AUTH_LOCK_MINUTES || 15)));
const PUBLIC_SIGNUP=String(process.env.IZAKHONO_AUTH_PUBLIC_SIGNUP||"false").toLowerCase()==="true";
const REQUIRE_EMAIL_VERIFICATION=String(process.env.IZAKHONO_AUTH_REQUIRE_EMAIL_VERIFICATION||"true").toLowerCase()!=="false";
const PUBLIC_BASE_URL=(process.env.IZAKHONO_AUTH_PUBLIC_BASE_URL||"https://one.domains.izakhonoafrica.co.za").replace(/\/$/,"");
const NOTIFY_URL=(process.env.IZAKHONO_NOTIFY_URL||"http://127.0.0.1:8840").replace(/\/$/,"");
const NOTIFY_KEY=process.env.IZAKHONO_NOTIFY_KEY||"";
const VERIFY_HOURS=Math.min(72,Math.max(1,Number(process.env.IZAKHONO_AUTH_VERIFY_HOURS||24)));
const RESET_MINUTES=Math.min(120,Math.max(10,Number(process.env.IZAKHONO_AUTH_RESET_MINUTES||30)));
const PUBLIC_ACTION_LIMIT_PER_HOUR=Math.min(50,Math.max(2,Number(process.env.IZAKHONO_AUTH_PUBLIC_ACTION_LIMIT_PER_HOUR||10)));

mkdirSync(dirname(DB_PATH),{recursive:true});

function encryptionKey(){
  if(!ENCRYPTION_KEY_RAW) throw new Error("IZAKHONO_AUTH_ENCRYPTION_KEY is not configured");
  const key=Buffer.from(ENCRYPTION_KEY_RAW,"base64");
  if(key.length!==32) throw new Error("IZAKHONO_AUTH_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
encryptionKey();

const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lock_until TEXT,
    totp_secret_encrypted TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS roles(
    name TEXT PRIMARY KEY,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS permissions(
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_roles(
    user_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(user_id,role_name),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(role_name) REFERENCES roles(name) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS role_permissions(
    role_name TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(role_name,permission_code),
    FOREIGN KEY(role_name) REFERENCES roles(name) ON DELETE CASCADE,
    FOREIGN KEY(permission_code) REFERENCES permissions(code) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions(
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    ip_hash TEXT,
    user_agent_hash TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id,expires_at);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS service_accounts(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    permissions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys(
    id TEXT PRIMARY KEY,
    service_account_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY(service_account_id) REFERENCES service_accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    actor_type TEXT NOT NULL CHECK(actor_type IN ('anonymous','user','service','system')),
    actor_ref TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_ref TEXT,
    outcome TEXT NOT NULL CHECK(outcome IN ('success','blocked','failed')),
    ip_hash TEXT,
    user_agent_hash TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_ledger(occurred_at DESC);
  CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_ledger(actor_type,actor_ref,occurred_at DESC);
`);
const userColumns=new Set(db.prepare("PRAGMA table_info(users)").all().map(x=>x.name));
if(!userColumns.has("email_verified_at")) db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");

db.exec(`
  CREATE TABLE IF NOT EXISTS email_verifications(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications(user_id,expires_at);

  CREATE TABLE IF NOT EXISTS password_resets(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id,expires_at);
`);

const loginBuckets=new Map();

function json(res,status,body,headers={}){
  const payload=JSON.stringify(body);
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":Buffer.byteLength(payload),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
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

function sha256(value){
  return createHash("sha256").update(value).digest("hex");
}

function auditFingerprint(value){
  return createHmac("sha256",encryptionKey()).update(value||"unknown").digest("hex");
}

function ip(req){ return req.socket.remoteAddress || "unknown"; }
function ua(req){ return String(req.headers["user-agent"]||"unknown").slice(0,500); }

function audit(req,actorType,actorRef,action,targetType,targetRef,outcome,detail={}){
  db.prepare(`
    INSERT INTO audit_ledger(actor_type,actor_ref,action,target_type,target_ref,outcome,ip_hash,user_agent_hash,detail_json)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).run(
    actorType,actorRef??null,action,targetType??null,targetRef??null,outcome,
    auditFingerprint(ip(req)),auditFingerprint(ua(req)),JSON.stringify(detail)
  );
}

async function readJson(req,limit=256*1024){
  let total=0; const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

function normalizeEmail(value){
  if(typeof value!=="string") throw new Error("INVALID_EMAIL");
  const email=value.trim().toLowerCase();
  if(email.length<5 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  return email;
}

function validPassword(value){
  return typeof value==="string" && value.length>=12 && value.length<=256;
}

function passwordDigest(password,saltHex){
  return scryptSync(password,Buffer.from(saltHex,"hex"),64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString("hex");
}

function createPassword(password){
  if(!validPassword(password)) throw new Error("WEAK_PASSWORD");
  const salt=randomBytes(16).toString("hex");
  return {salt,hash:passwordDigest(password,salt)};
}

function verifyPassword(user,password){
  if(typeof password!=="string" || password.length>256) return false;
  const calculated=passwordDigest(password,user.password_salt);
  return safeEqual(calculated,user.password_hash);
}

function encryptSecret(plaintext){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const ciphertext=Buffer.concat([cipher.update(plaintext,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:tag.toString("base64"),ct:ciphertext.toString("base64")});
}

function decryptSecret(envelope){
  const parsed=JSON.parse(envelope);
  if(parsed.v!==1) throw new Error("UNSUPPORTED_SECRET_ENVELOPE");
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(parsed.iv,"base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(parsed.ct,"base64")),decipher.final()]).toString("utf8");
}

const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buffer){
  let bits=0,value=0,out="";
  for(const byte of buffer){
    value=(value<<8)|byte; bits+=8;
    while(bits>=5){ out+=B32[(value>>>(bits-5))&31]; bits-=5; }
  }
  if(bits>0) out+=B32[(value<<(5-bits))&31];
  return out;
}
function base32Decode(input){
  const clean=String(input).replace(/=+$/,"").replace(/\s+/g,"").toUpperCase();
  let bits=0,value=0; const bytes=[];
  for(const ch of clean){
    const idx=B32.indexOf(ch);
    if(idx<0) throw new Error("INVALID_BASE32");
    value=(value<<5)|idx; bits+=5;
    if(bits>=8){ bytes.push((value>>>(bits-8))&255); bits-=8; }
  }
  return Buffer.from(bytes);
}

function totpCode(secret,at=Date.now()){
  const counter=Math.floor(at/30000);
  const buf=Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h=createHmac("sha1",base32Decode(secret)).update(buf).digest();
  const offset=h[h.length-1]&0x0f;
  const n=((h[offset]&0x7f)<<24)|((h[offset+1]&0xff)<<16)|((h[offset+2]&0xff)<<8)|(h[offset+3]&0xff);
  return String(n%1_000_000).padStart(6,"0");
}

function verifyTotp(secret,code){
  if(typeof code!=="string" || !/^\d{6}$/.test(code)) return false;
  for(const shift of [-30000,0,30000]){
    if(safeEqual(totpCode(secret,Date.now()+shift),code)) return true;
  }
  return false;
}

function rateAllowed(req,subject,limit=LOGIN_LIMIT_PER_MIN,windowMs=60000){
  const key=ip(req)+"|"+subject;
  const now=Date.now();
  const item=loginBuckets.get(key)||{count:0,windowStart:now};
  if(now-item.windowStart>=windowMs){item.count=0;item.windowStart=now;}
  item.count++;
  loginBuckets.set(key,item);
  return item.count<=limit;
}
setInterval(()=>{
  const cutoff=Date.now()-5*60000;
  for(const [key,value] of loginBuckets) if(value.windowStart<cutoff) loginBuckets.delete(key);
},60000).unref();

function rolesForUser(userId){
  return db.prepare("SELECT role_name AS role FROM user_roles WHERE user_id=? ORDER BY role_name").all(userId).map(x=>x.role);
}

function permissionsForUser(userId){
  return db.prepare(`
    SELECT DISTINCT rp.permission_code AS permission
    FROM user_roles ur JOIN role_permissions rp ON rp.role_name=ur.role_name
    WHERE ur.user_id=? ORDER BY rp.permission_code
  `).all(userId).map(x=>x.permission);
}

function publicUser(user){
  return {
    id:user.id,email:user.email,displayName:user.display_name,status:user.status,
    emailVerified:Boolean(user.email_verified_at),
    mfaEnabled:Boolean(user.totp_enabled),
    roles:rolesForUser(user.id),
    permissions:permissionsForUser(user.id)
  };
}

function createSession(req,userId){
  const raw=randomBytes(32).toString("base64url");
  const id=randomUUID();
  db.prepare(`
    INSERT INTO sessions(id,token_hash,user_id,expires_at,ip_hash,user_agent_hash)
    VALUES(?,?,?,datetime('now',?),?,?)
  `).run(id,sha256(raw),userId,"+"+SESSION_HOURS+" hours",auditFingerprint(ip(req)),auditFingerprint(ua(req)));
  return raw;
}

function tokenFromRequest(req){
  const auth=String(req.headers.authorization||"");
  if(auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookies=String(req.headers.cookie||"").split(";").map(x=>x.trim());
  for(const cookie of cookies){
    if(cookie.startsWith("izakhono_session=")) return decodeURIComponent(cookie.slice("izakhono_session=".length));
  }
  return null;
}

function sessionUser(req){
  const raw=tokenFromRequest(req);
  if(!raw) return null;
  const row=db.prepare(`
    SELECT s.id AS session_id,u.*
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.status='active'
  `).get(sha256(raw));
  if(!row) return null;
  db.prepare("UPDATE sessions SET last_seen_at=datetime('now') WHERE id=?").run(row.session_id);
  return {sessionId:row.session_id,user:row};
}

function requirePermission(req,res,permission){
  const session=sessionUser(req);
  if(!session){json(res,401,{error:"Authentication required"});return null;}
  const permissions=permissionsForUser(session.user.id);
  if(!permissions.includes(permission)){
    audit(req,"user",session.user.id,"authorization.denied","permission",permission,"blocked",{});
    json(res,403,{error:"Permission denied"});
    return null;
  }
  return session;
}

function bootstrapDefaults(userId){
  db.exec("BEGIN IMMEDIATE");
  try{
    db.prepare("INSERT OR IGNORE INTO roles(name,description) VALUES('owner','Platform owner / root administrator')").run();
    for(const [code,description] of [
      ["auth.admin","Manage users, roles, permissions and service identities"],
      ["growth.read","Read Growth OS data"],
      ["growth.write","Perform approved Growth OS mutations"]
    ]){
      db.prepare("INSERT OR IGNORE INTO permissions(code,description) VALUES(?,?)").run(code,description);
      db.prepare("INSERT OR IGNORE INTO role_permissions(role_name,permission_code) VALUES('owner',?)").run(code);
    }
    db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role_name) VALUES(?,'owner')").run(userId);
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
}

function apiKeyActor(req){
  const raw=String(req.headers["x-api-key"]||"");
  if(!raw) return null;
  const row=db.prepare(`
    SELECT a.id AS key_id,a.service_account_id,s.name,s.status,s.permissions_json
    FROM api_keys a JOIN service_accounts s ON s.id=a.service_account_id
    WHERE a.key_hash=? AND a.revoked_at IS NULL
  `).get(sha256(raw));
  if(!row || row.status!=="active") return null;
  db.prepare("UPDATE api_keys SET last_used_at=datetime('now') WHERE id=?").run(row.key_id);
  return {id:row.service_account_id,name:row.name,permissions:JSON.parse(row.permissions_json)};
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO AUTH NODE",
        status:"healthy",
        users:Number(db.prepare("SELECT count(*) AS count FROM users").get()?.count||0),
        activeSessions:Number(db.prepare("SELECT count(*) AS count FROM sessions WHERE revoked_at IS NULL AND datetime(expires_at)>datetime('now')").get()?.count||0),
        thirdPartyAuthRequired:false
      });
    }

    if(req.method==="POST" && url.pathname==="/v1/bootstrap"){
      if(!BOOTSTRAP_KEY || !safeEqual(req.headers["x-bootstrap-key"],BOOTSTRAP_KEY)) return json(res,401,{error:"Unauthorized"});
      const count=Number(db.prepare("SELECT count(*) AS count FROM users").get()?.count||0);
      if(count>0) return json(res,409,{error:"Bootstrap already completed"});
      const body=await readJson(req);
      const email=normalizeEmail(body?.email);
      if(!validPassword(body?.password)) return json(res,400,{error:"Password must be 12-256 characters"});
      const displayName=String(body?.displayName||"Owner").trim().slice(0,120);
      const {salt,hash}=createPassword(body.password);
      const id=randomUUID();
      db.prepare(`
        INSERT INTO users(id,email,display_name,password_hash,password_salt)
        VALUES(?,?,?,?,?)
      `).run(id,email,displayName,hash,salt);
      bootstrapDefaults(id);
      audit(req,"system","bootstrap","user.bootstrap","user",id,"success",{});
      return json(res,201,{user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(id))});
    }

    if(req.method==="POST" && url.pathname==="/v1/login"){
      const body=await readJson(req);
      let email;
      try{email=normalizeEmail(body?.email);}catch{return json(res,401,{error:"Invalid credentials"});}
      if(!rateAllowed(req,email)){
        audit(req,"anonymous",null,"login.rate_limit","user",email,"blocked",{});
        return json(res,429,{error:"Too many login attempts","retryAfterSeconds":60},{"retry-after":"60"});
      }

      const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
      if(!user || user.status!=="active"){
        audit(req,"anonymous",null,"login","user",email,"failed",{reason:"invalid"});
        return json(res,401,{error:"Invalid credentials"});
      }
      if(user.lock_until && new Date(user.lock_until).getTime()>Date.now()){
        audit(req,"anonymous",null,"login","user",user.id,"blocked",{reason:"locked"});
        return json(res,423,{error:"Account temporarily locked"});
      }

      if(!verifyPassword(user,body?.password)){
        const failed=Number(user.failed_attempts||0)+1;
        if(failed>=LOCK_AFTER){
          db.prepare("UPDATE users SET failed_attempts=0,lock_until=datetime('now',?),updated_at=datetime('now') WHERE id=?").run("+"+LOCK_MINUTES+" minutes",user.id);
        }else{
          db.prepare("UPDATE users SET failed_attempts=?,updated_at=datetime('now') WHERE id=?").run(failed,user.id);
        }
        audit(req,"anonymous",null,"login","user",user.id,"failed",{reason:"password"});
        return json(res,401,{error:"Invalid credentials"});
      }

      if(user.totp_enabled){
        const secret=decryptSecret(user.totp_secret_encrypted);
        if(!verifyTotp(secret,body?.totp)){
          audit(req,"anonymous",null,"login","user",user.id,"failed",{reason:"mfa"});
          return json(res,401,{error:body?.totp?"Invalid MFA code":"MFA required",code:"MFA_REQUIRED"});
        }
      }

      db.prepare("UPDATE users SET failed_attempts=0,lock_until=NULL,last_login_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(user.id);
      const token=createSession(req,user.id);
      audit(req,"user",user.id,"login","session",null,"success",{mfa:Boolean(user.totp_enabled)});
      const headers={};
      if(COOKIE_DOMAIN){
        headers["set-cookie"]=`izakhono_session=${encodeURIComponent(token)}; Path=/; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS*3600}`;
      }
      return json(res,200,{token,tokenType:"Bearer",expiresInSeconds:SESSION_HOURS*3600,user:publicUser(user)},headers);
    }

    if(req.method==="GET" && url.pathname==="/v1/me"){
      const session=sessionUser(req);
      if(!session) return json(res,401,{error:"Authentication required"});
      return json(res,200,{user:publicUser(session.user),session:{id:session.sessionId}});
    }

    if(req.method==="POST" && url.pathname==="/v1/logout"){
      const session=sessionUser(req);
      if(!session) return json(res,200,{loggedOut:true});
      db.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE id=?").run(session.sessionId);
      audit(req,"user",session.user.id,"logout","session",session.sessionId,"success",{});
      return json(res,200,{loggedOut:true},{"set-cookie":"izakhono_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"});
    }

    if(req.method==="POST" && url.pathname==="/v1/mfa/setup"){
      const session=sessionUser(req);
      if(!session) return json(res,401,{error:"Authentication required"});
      const secret=base32Encode(randomBytes(20));
      db.prepare("UPDATE users SET totp_secret_encrypted=?,totp_enabled=0,updated_at=datetime('now') WHERE id=?").run(encryptSecret(secret),session.user.id);
      const issuer=encodeURIComponent("IZAKHONO");
      const account=encodeURIComponent(session.user.email);
      audit(req,"user",session.user.id,"mfa.setup","user",session.user.id,"success",{});
      return json(res,200,{secret,otpauthUri:`otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`});
    }

    if(req.method==="POST" && url.pathname==="/v1/mfa/enable"){
      const session=sessionUser(req);
      if(!session) return json(res,401,{error:"Authentication required"});
      const body=await readJson(req);
      const fresh=db.prepare("SELECT * FROM users WHERE id=?").get(session.user.id);
      if(!fresh.totp_secret_encrypted) return json(res,409,{error:"Run MFA setup first"});
      if(!verifyTotp(decryptSecret(fresh.totp_secret_encrypted),body?.code)) return json(res,400,{error:"Invalid MFA code"});
      db.prepare("UPDATE users SET totp_enabled=1,updated_at=datetime('now') WHERE id=?").run(session.user.id);
      audit(req,"user",session.user.id,"mfa.enable","user",session.user.id,"success",{});
      return json(res,200,{enabled:true});
    }

    if(req.method==="POST" && url.pathname==="/v1/admin/users"){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const body=await readJson(req);
      const email=normalizeEmail(body?.email);
      if(!validPassword(body?.password)) return json(res,400,{error:"Password must be 12-256 characters"});
      const {salt,hash}=createPassword(body.password);
      const id=randomUUID();
      db.prepare("INSERT INTO users(id,email,display_name,password_hash,password_salt) VALUES(?,?,?,?,?)")
        .run(id,email,String(body?.displayName||email).slice(0,120),hash,salt);
      audit(req,"user",admin.user.id,"user.create","user",id,"success",{});
      return json(res,201,{user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(id))});
    }

    if(req.method==="POST" && url.pathname==="/v1/admin/roles"){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(name)) return json(res,400,{error:"Invalid role"});
      db.prepare("INSERT OR IGNORE INTO roles(name,description) VALUES(?,?)").run(name,String(body?.description||"").slice(0,500));
      audit(req,"user",admin.user.id,"role.create","role",name,"success",{});
      return json(res,201,{name});
    }

    if(req.method==="POST" && url.pathname==="/v1/admin/permissions"){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const body=await readJson(req);
      const code=String(body?.code||"").trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9._:-]{2,100}$/.test(code)) return json(res,400,{error:"Invalid permission"});
      db.prepare("INSERT OR IGNORE INTO permissions(code,description) VALUES(?,?)").run(code,String(body?.description||"").slice(0,500));
      audit(req,"user",admin.user.id,"permission.create","permission",code,"success",{});
      return json(res,201,{code});
    }

    const rolePermission=url.pathname.match(/^\/v1\/admin\/roles\/([^/]+)\/permissions$/);
    if(req.method==="POST" && rolePermission){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const body=await readJson(req);
      const role=decodeURIComponent(rolePermission[1]);
      const permission=String(body?.permission||"");
      if(!db.prepare("SELECT 1 AS ok FROM roles WHERE name=?").get(role)) return json(res,404,{error:"Role not found"});
      if(!db.prepare("SELECT 1 AS ok FROM permissions WHERE code=?").get(permission)) return json(res,404,{error:"Permission not found"});
      db.prepare("INSERT OR IGNORE INTO role_permissions(role_name,permission_code) VALUES(?,?)").run(role,permission);
      audit(req,"user",admin.user.id,"role.permission.add","role",role,"success",{permission});
      return json(res,200,{role,permission});
    }

    const userRole=url.pathname.match(/^\/v1\/admin\/users\/([^/]+)\/roles$/);
    if(req.method==="POST" && userRole){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const body=await readJson(req);
      const userId=decodeURIComponent(userRole[1]);
      const role=String(body?.role||"");
      if(!db.prepare("SELECT 1 AS ok FROM users WHERE id=?").get(userId)) return json(res,404,{error:"User not found"});
      if(!db.prepare("SELECT 1 AS ok FROM roles WHERE name=?").get(role)) return json(res,404,{error:"Role not found"});
      db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role_name) VALUES(?,?)").run(userId,role);
      audit(req,"user",admin.user.id,"user.role.add","user",userId,"success",{role});
      return json(res,200,{userId,role});
    }

    if(req.method==="POST" && url.pathname==="/v1/admin/service-accounts"){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) return json(res,400,{error:"Invalid service account name"});
      const permissions=Array.isArray(body?.permissions)?body.permissions.filter(x=>typeof x==="string").slice(0,100):[];
      const id=randomUUID();
      db.prepare("INSERT INTO service_accounts(id,name,permissions_json) VALUES(?,?,?)").run(id,name,JSON.stringify(permissions));
      const raw="izk_"+randomBytes(32).toString("base64url");
      const keyId=randomUUID();
      db.prepare("INSERT INTO api_keys(id,service_account_id,key_hash,prefix) VALUES(?,?,?,?)")
        .run(keyId,id,sha256(raw),raw.slice(0,12));
      audit(req,"user",admin.user.id,"service_account.create","service",id,"success",{permissions});
      return json(res,201,{serviceAccount:{id,name,permissions},apiKey:raw});
    }

    if(req.method==="GET" && url.pathname==="/v1/service/whoami"){
      const actor=apiKeyActor(req);
      if(!actor) return json(res,401,{error:"Invalid API key"});
      audit(req,"service",actor.id,"service.whoami","service",actor.id,"success",{});
      return json(res,200,{service:actor});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/audit"){
      const admin=requirePermission(req,res,"auth.admin"); if(!admin) return;
      const limit=Math.min(500,Math.max(1,Number(url.searchParams.get("limit")||100)));
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT ?").all(limit)});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(["INVALID_EMAIL","WEAK_PASSWORD"].includes(message)) return json(res,400,{error:message});
    if(String(error?.message||"").includes("UNIQUE constraint failed")){
      return json(res,409,{error:"Resource already exists"});
    }
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO AUTH NODE listening on http://${HOST}:${PORT}`);
  if(!BOOTSTRAP_KEY) console.warn("WARNING: IZAKHONO_AUTH_BOOTSTRAP_KEY missing; first-user bootstrap is disabled.");
});

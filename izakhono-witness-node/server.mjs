import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, sign, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8930);
const ADMIN_KEY=process.env.IZAKHONO_WITNESS_ADMIN_KEY || "";
const DB_PATH=resolve(process.env.IZAKHONO_WITNESS_DB || "./data/witness.sqlite");
const PRIVATE_KEY_FILE=resolve(process.env.IZAKHONO_WITNESS_PRIVATE_KEY_FILE || "./keys/witness-private.pem");
const PUBLIC_KEY_FILE=resolve(process.env.IZAKHONO_WITNESS_PUBLIC_KEY_FILE || "./keys/witness-public.pem");
const IS_TEST=process.env.NODE_ENV==="test";

const privateKey=readFileSync(PRIVATE_KEY_FILE,"utf8");
const publicKey=readFileSync(PUBLIC_KEY_FILE,"utf8");

mkdirSync(dirname(DB_PATH),{recursive:true});
const db=new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=FULL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;

  CREATE TABLE IF NOT EXISTS clusters(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    lease_ttl_seconds INTEGER NOT NULL,
    current_holder TEXT,
    fencing_token INTEGER NOT NULL DEFAULT 0,
    lease_until INTEGER,
    frozen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members(
    id TEXT PRIMARY KEY,
    cluster_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT,
    UNIQUE(cluster_id,name),
    FOREIGN KEY(cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    cluster_id TEXT,
    member_id TEXT,
    fencing_token INTEGER,
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

function equal(a,b){
  const aa=Buffer.from(typeof a==="string"?a:"");
  const bb=Buffer.from(typeof b==="string"?b:"");
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}
function sha256(v){return createHash("sha256").update(v).digest("hex");}
function admin(req){return Boolean(ADMIN_KEY)&&equal(req.headers["x-izakhono-key"],ADMIN_KEY);}
function validName(v){return typeof v==="string"&&/^[a-z0-9][a-z0-9._-]{1,79}$/.test(v);}

async function readJson(req,limit=128*1024){
  let total=0; const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>limit) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):null;
}

function audit(action,clusterId,memberId,token,outcome,detail={}){
  db.prepare("INSERT INTO audit_ledger(action,cluster_id,member_id,fencing_token,outcome,detail_json) VALUES(?,?,?,?,?,?)")
    .run(action,clusterId??null,memberId??null,token??null,outcome,JSON.stringify(detail));
}

function authenticateMember(req,clusterId){
  const raw=String(req.headers["x-witness-member-key"]||"");
  if(!raw) return null;
  const row=db.prepare(`
    SELECT m.*,c.name AS cluster_name,c.frozen,c.lease_ttl_seconds,c.current_holder,c.fencing_token,c.lease_until
    FROM members m JOIN clusters c ON c.id=m.cluster_id
    WHERE m.cluster_id=? AND m.key_hash=? AND m.status='active'
  `).get(clusterId,sha256(raw));
  if(row) db.prepare("UPDATE members SET last_seen_at=datetime('now') WHERE id=?").run(row.id);
  return row||null;
}

function receipt(cluster,member){
  const body={
    v:1,
    clusterId:cluster.id,
    cluster:cluster.name,
    memberId:member.id,
    member:member.name,
    fencingToken:Number(cluster.fencing_token),
    leaseUntil:Number(cluster.lease_until),
    issuedAt:Math.floor(Date.now()/1000)
  };
  const canonical=JSON.stringify(body);
  return {
    ...body,
    signature:sign(null,Buffer.from(canonical),privateKey).toString("base64"),
    algorithm:"Ed25519"
  };
}

function leaseView(cluster){
  const holder=cluster.current_holder
    ? db.prepare("SELECT id,name,status,last_seen_at FROM members WHERE id=?").get(cluster.current_holder)
    : null;
  return {
    clusterId:cluster.id,
    cluster:cluster.name,
    holder,
    fencingToken:Number(cluster.fencing_token),
    leaseUntil:cluster.lease_until?Number(cluster.lease_until):null,
    leaseActive:Boolean(cluster.current_holder && Number(cluster.lease_until)>Math.floor(Date.now()/1000)),
    frozen:Boolean(cluster.frozen)
  };
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");

    if(req.method==="GET" && url.pathname==="/health"){
      return json(res,200,{
        product:"IZAKHONO WITNESS NODE",
        status:"healthy",
        clusters:Number(db.prepare("SELECT count(*) AS count FROM clusters").get()?.count||0),
        fencing:"monotonic-token",
        leaseReceipts:"Ed25519",
        automaticFailover:false,
        independentFailureDomainRequired:true,
        thirdPartyWitnessRequired:false
      });
    }

    if(req.method==="GET" && url.pathname==="/v1/public-key"){
      return json(res,200,{algorithm:"Ed25519",publicKeyPem:publicKey});
    }

    if(req.method==="POST" && url.pathname==="/v1/clusters"){
      if(!admin(req)) return json(res,401,{error:"Unauthorized"});
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!validName(name)) return json(res,400,{error:"Invalid cluster name"});
      const min=IS_TEST?1:5;
      const ttl=Math.min(300,Math.max(min,Number(body?.leaseTtlSeconds||15)));
      const id=randomUUID();
      db.prepare("INSERT INTO clusters(id,name,lease_ttl_seconds) VALUES(?,?,?)").run(id,name,ttl);
      audit("cluster.create",id,null,0,"success",{ttl});
      return json(res,201,{cluster:db.prepare("SELECT * FROM clusters WHERE id=?").get(id)});
    }

    const addMember=url.pathname.match(/^\/v1\/clusters\/([^/]+)\/members$/);
    if(req.method==="POST" && addMember){
      if(!admin(req)) return json(res,401,{error:"Unauthorized"});
      const cluster=db.prepare("SELECT * FROM clusters WHERE id=?").get(addMember[1]);
      if(!cluster) return json(res,404,{error:"Cluster not found"});
      const body=await readJson(req);
      const name=String(body?.name||"").trim().toLowerCase();
      if(!validName(name)) return json(res,400,{error:"Invalid member name"});
      const id=randomUUID();
      const raw="izw_"+randomBytes(32).toString("base64url");
      db.prepare("INSERT INTO members(id,cluster_id,name,key_hash) VALUES(?,?,?,?)")
        .run(id,cluster.id,name,sha256(raw));
      audit("member.create",cluster.id,id,cluster.fencing_token,"success",{name});
      return json(res,201,{member:{id,name,clusterId:cluster.id},memberKey:raw});
    }

    const lease=url.pathname.match(/^\/v1\/clusters\/([^/]+)\/lease$/);
    if(req.method==="GET" && lease){
      const member=authenticateMember(req,lease[1]);
      if(!member) return json(res,401,{error:"Invalid member credential"});
      const cluster=db.prepare("SELECT * FROM clusters WHERE id=?").get(lease[1]);
      return json(res,200,leaseView(cluster));
    }

    const acquire=url.pathname.match(/^\/v1\/clusters\/([^/]+)\/lease\/acquire$/);
    if(req.method==="POST" && acquire){
      const member=authenticateMember(req,acquire[1]);
      if(!member) return json(res,401,{error:"Invalid member credential"});
      const now=Math.floor(Date.now()/1000);

      db.exec("BEGIN IMMEDIATE");
      try{
        const cluster=db.prepare("SELECT * FROM clusters WHERE id=?").get(acquire[1]);
        if(!cluster) throw new Error("CLUSTER_NOT_FOUND");
        if(cluster.frozen) throw new Error("CLUSTER_FROZEN");

        const active=cluster.current_holder && Number(cluster.lease_until)>now;
        if(active && cluster.current_holder!==member.id){
          db.exec("ROLLBACK");
          audit("lease.acquire",cluster.id,member.id,cluster.fencing_token,"blocked",{holder:cluster.current_holder,leaseUntil:cluster.lease_until});
          return json(res,409,{error:"Leadership lease is held by another member",...leaseView(cluster)});
        }

        let token=Number(cluster.fencing_token);
        if(!active || cluster.current_holder!==member.id) token+=1;
        const until=now+Number(cluster.lease_ttl_seconds);
        db.prepare(`
          UPDATE clusters SET current_holder=?,fencing_token=?,lease_until=?,updated_at=datetime('now')
          WHERE id=?
        `).run(member.id,token,until,cluster.id);
        db.exec("COMMIT");

        const updated=db.prepare("SELECT * FROM clusters WHERE id=?").get(cluster.id);
        const signed=receipt(updated,member);
        audit("lease.acquire",cluster.id,member.id,token,"success",{leaseUntil:until,renewal:active&&cluster.current_holder===member.id});
        return json(res,200,{lease:leaseView(updated),receipt:signed});
      }catch(error){
        try{db.exec("ROLLBACK");}catch{}
        throw error;
      }
    }

    const release=url.pathname.match(/^\/v1\/clusters\/([^/]+)\/lease\/release$/);
    if(req.method==="POST" && release){
      const member=authenticateMember(req,release[1]);
      if(!member) return json(res,401,{error:"Invalid member credential"});
      const now=Math.floor(Date.now()/1000);
      const cluster=db.prepare("SELECT * FROM clusters WHERE id=?").get(release[1]);
      if(!cluster) return json(res,404,{error:"Cluster not found"});
      if(cluster.current_holder!==member.id || Number(cluster.lease_until)<=now){
        return json(res,409,{error:"Member does not hold the active lease"});
      }
      db.prepare("UPDATE clusters SET current_holder=NULL,lease_until=NULL,updated_at=datetime('now') WHERE id=?").run(cluster.id);
      audit("lease.release",cluster.id,member.id,cluster.fencing_token,"success",{});
      return json(res,200,{released:true,fencingToken:Number(cluster.fencing_token)});
    }

    const freeze=url.pathname.match(/^\/v1\/clusters\/([^/]+)\/freeze$/);
    if(req.method==="POST" && freeze){
      if(!admin(req)) return json(res,401,{error:"Unauthorized"});
      const body=await readJson(req);
      const frozen=body?.frozen!==false;
      const changed=db.prepare("UPDATE clusters SET frozen=?,updated_at=datetime('now') WHERE id=?").run(frozen?1:0,freeze[1]);
      if(!Number(changed.changes||0)) return json(res,404,{error:"Cluster not found"});
      audit("cluster.freeze",freeze[1],null,null,"success",{frozen});
      return json(res,200,{clusterId:freeze[1],frozen});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/clusters"){
      if(!admin(req)) return json(res,401,{error:"Unauthorized"});
      return json(res,200,{clusters:db.prepare("SELECT * FROM clusters ORDER BY name").all()});
    }

    if(req.method==="GET" && url.pathname==="/v1/admin/audit"){
      if(!admin(req)) return json(res,401,{error:"Unauthorized"});
      return json(res,200,{entries:db.prepare("SELECT * FROM audit_ledger ORDER BY id DESC LIMIT 500").all()});
    }

    return json(res,404,{error:"Not found"});
  }catch(error){
    const message=String(error?.message||"Unknown error");
    if(message==="BODY_TOO_LARGE") return json(res,413,{error:"Request body too large"});
    if(message==="CLUSTER_NOT_FOUND") return json(res,404,{error:"Cluster not found"});
    if(message==="CLUSTER_FROZEN") return json(res,423,{error:"Cluster leadership is frozen"});
    if(message.includes("UNIQUE constraint failed")) return json(res,409,{error:"Resource already exists"});
    console.error(error);
    return json(res,500,{error:"Internal server error"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO WITNESS NODE listening on http://${HOST}:${PORT}`);
  console.log("Witness must run in an independent failure domain for production quorum value.");
  if(!ADMIN_KEY) console.warn("WARNING: IZAKHONO_WITNESS_ADMIN_KEY missing; admin API is disabled.");
});

import { readFileSync, writeFileSync, renameSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Resolver } from "node:dns/promises";

function required(name){
  const value=process.env[name];
  if(!value) throw new Error(name+" is required");
  return value;
}
function parseEnv(path){
  const out={};
  for(const raw of readFileSync(path,"utf8").split(/\r?\n/)){
    const line=raw.trim();
    if(!line || line.startsWith("#")) continue;
    const i=line.indexOf("=");
    if(i>0) out[line.slice(0,i).trim()]=line.slice(i+1);
  }
  return out;
}
function normalizeFqdn(value){
  const v=String(value||"").trim().toLowerCase().replace(/\.+$/,"");
  if(!v || !/^[a-z0-9.-]+$/.test(v) || !v.includes(".")) throw new Error("invalid route fqdn");
  return v+".";
}
function ipv4(value){
  const parts=String(value||"").split(".");
  if(parts.length!==4) throw new Error("route target must be IPv4 in V1");
  for(const p of parts){
    if(!/^\d{1,3}$/.test(p) || Number(p)<0 || Number(p)>255) throw new Error("invalid IPv4");
  }
  return parts.map(Number).join(".");
}
function effectiveName(recordName,zone){
  const n=String(recordName||"@").trim().toLowerCase();
  if(n==="@" || n==="") return zone;
  if(n.endsWith(".")) return n;
  return n+"."+zone;
}
function relativeName(fqdn,zone){
  if(fqdn===zone) return "@";
  const suffix="."+zone;
  if(!fqdn.endsWith(suffix)) throw new Error("route fqdn is outside configured zone");
  return fqdn.slice(0,-suffix.length);
}

const envPath=resolve(process.env.IZAKHONO_DNS_ENV || "/etc/izakhono/dns-node.env");
const env=parseEnv(envPath);
const zonePath=resolve(process.env.IZAKHONO_DNS_ZONE || env.IZAKHONO_DNS_ZONE || "/etc/izakhono/dns-zone.json");
const statePath=resolve(process.env.IZAKHONO_HA_DNS_STATE || "/var/lib/izakhono-dns/ha-route-state.json");
const fqdn=normalizeFqdn(required("IZAKHONO_HA_ROUTE_FQDN"));
const targetIp=ipv4(required("IZAKHONO_HA_ROUTE_IP"));
const target=required("IZAKHONO_FAILOVER_TARGET");
const token=Number(required("IZAKHONO_FAILOVER_FENCING_TOKEN"));
const previousToken=Number(required("IZAKHONO_FAILOVER_PREVIOUS_TOKEN"));

if(!["primary","standby"].includes(target)) throw new Error("invalid failover target");
if(!Number.isSafeInteger(token) || token<=0) throw new Error("invalid fencing token");
if(!Number.isSafeInteger(previousToken) || previousToken<0 || token<=previousToken) throw new Error("fencing token must be newer than previous token");

let priorState=null;
try{priorState=JSON.parse(readFileSync(statePath,"utf8"));}catch{}
if(priorState && Number(priorState.fencingToken)>=token){
  throw new Error("stale fencing token refused");
}

const zone=JSON.parse(readFileSync(zonePath,"utf8"));
const zoneName=normalizeFqdn(zone.zone);
const rel=relativeName(fqdn,zoneName);
zone.records=Array.isArray(zone.records)?zone.records:[];
const matches=zone.records.filter(r=>String(r.type||"").toUpperCase()==="A" && effectiveName(r.name,zoneName)===fqdn);
const previousIps=matches.map(r=>String(r.value));
if(matches.length){
  for(const r of matches){ r.value=targetIp; r.ttl=Math.min(Number(r.ttl||zone.ttl||60),60); }
}else{
  zone.records.push({name:rel,type:"A",value:targetIp,ttl:60});
}

zone.soa=zone.soa||{};
const oldSerial=Number(zone.soa.serial||0);
zone.soa.serial=Math.max(oldSerial+1,Math.floor(Date.now()/1000));

mkdirSync(dirname(statePath),{recursive:true});
const backup=zonePath+".pre-failover-"+token+".bak";
copyFileSync(zonePath,backup);
const tmp=zonePath+".tmp-"+process.pid;
writeFileSync(tmp,JSON.stringify(zone,null,2)+"\n",{mode:0o640});
renameSync(tmp,zonePath);

const controlHost=env.IZAKHONO_DNS_CONTROL_HOST || "127.0.0.1";
const controlPort=Number(env.IZAKHONO_DNS_CONTROL_PORT || 8900);
const controlKey=env.IZAKHONO_DNS_KEY;
if(!controlKey) throw new Error("IZAKHONO_DNS_KEY missing");

const reload=await fetch(`http://${controlHost}:${controlPort}/v1/reload`,{
  method:"POST",
  headers:{"x-izakhono-key":controlKey},
  signal:AbortSignal.timeout(5000)
});
if(!reload.ok) throw new Error("DNS reload failed: HTTP "+reload.status);

const dnsHost=env.IZAKHONO_DNS_HOST || "127.0.0.1";
const dnsPort=Number(env.IZAKHONO_DNS_PORT || 5353);
const resolver=new Resolver();
resolver.setServers([dnsPort===53?dnsHost:`${dnsHost}:${dnsPort}`]);
let answer=[];
for(let i=0;i<10;i++){
  try{
    answer=await resolver.resolve4(fqdn.replace(/\.$/,""));
    if(answer.includes(targetIp)) break;
  }catch{}
  await new Promise(r=>setTimeout(r,150));
}
if(!answer.includes(targetIp)){
  throw new Error("authoritative DNS verification failed; answer="+JSON.stringify(answer));
}

const state={
  product:"IZAKHONO HA DNS ROUTE",
  target,
  fqdn,
  ip:targetIp,
  previousIps,
  fencingToken:token,
  previousFencingToken:previousToken,
  serial:Number(zone.soa.serial),
  zone:zoneName,
  backup,
  verifiedAnswer:answer,
  automaticFailover:false,
  switchedAt:new Date().toISOString()
};
writeFileSync(statePath,JSON.stringify(state,null,2)+"\n",{mode:0o600});
process.stdout.write(JSON.stringify(state));

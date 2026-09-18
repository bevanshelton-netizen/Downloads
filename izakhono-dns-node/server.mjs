import dgram from "node:dgram";
import net from "node:net";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";

const HOST=process.env.IZAKHONO_DNS_HOST || "127.0.0.1";
const PORT=Number(process.env.IZAKHONO_DNS_PORT || 5353);
const TCP_ENABLED=(process.env.IZAKHONO_DNS_TCP || "true").toLowerCase()!=="false";
const ZONE_PATH=process.env.IZAKHONO_DNS_ZONE || "/etc/izakhono/dns-zone.json";
const CONTROL_HOST=process.env.IZAKHONO_DNS_CONTROL_HOST || "127.0.0.1";
const CONTROL_PORT=Number(process.env.IZAKHONO_DNS_CONTROL_PORT || 8900);
const CONTROL_KEY=process.env.IZAKHONO_DNS_KEY || "";
let cached={mtime:0,zone:null};

function fqdn(value,zone){
  const v=String(value||"").trim().toLowerCase();
  if(v==="@" || v==="") return zone;
  if(v.endsWith(".")) return v;
  return v+"."+zone;
}
function normalizeZone(raw){
  let zone=String(raw.zone||"").trim().toLowerCase();
  zone=zone.replace(/\.+$/,"")+".";
  if(zone===".") throw new Error("zone required");
  const ttl=Math.max(30,Number(raw.ttl||300));
  const soa=raw.soa||{};
  const z={zone,ttl,soa:{
    mname:fqdn(soa.mname||("ns1."+zone),zone),
    rname:fqdn(soa.rname||("hostmaster."+zone),zone),
    serial:Number(soa.serial||Math.floor(Date.now()/1000)),
    refresh:Number(soa.refresh||3600),
    retry:Number(soa.retry||600),
    expire:Number(soa.expire||1209600),
    minimum:Number(soa.minimum||300)
  },records:[]};
  for(const r of Array.isArray(raw.records)?raw.records:[]){
    const type=String(r.type||"").toUpperCase();
    if(!["A","AAAA","CNAME","NS","SOA","MX","TXT","CAA"].includes(type)) continue;
    z.records.push({name:fqdn(r.name||"@",zone),type,value:r.value,ttl:Math.max(30,Number(r.ttl||ttl)),priority:Number(r.priority||10),flags:Number(r.flags||0),tag:String(r.tag||"issue")});
  }
  return z;
}
function loadZone(){
  const st=statSync(ZONE_PATH);
  if(!cached.zone || st.mtimeMs!==cached.mtime) cached={mtime:st.mtimeMs,zone:normalizeZone(JSON.parse(readFileSync(ZONE_PATH,"utf8")))};
  return cached.zone;
}
function readName(buf,offset,depth=0){
  if(depth>12) throw new Error("compression loop");
  const labels=[]; let cursor=offset, consumed=0, jumped=false;
  while(true){
    if(cursor>=buf.length) throw new Error("name out of range");
    const len=buf[cursor];
    if((len&0xc0)===0xc0){
      if(cursor+1>=buf.length) throw new Error("bad pointer");
      const ptr=((len&0x3f)<<8)|buf[cursor+1];
      const nested=readName(buf,ptr,depth+1);
      labels.push(...nested.name.replace(/\.$/,"").split(".").filter(Boolean));
      if(!jumped) consumed+=2;
      jumped=true; break;
    }
    cursor++; if(!jumped) consumed++;
    if(len===0) break;
    if(len>63 || cursor+len>buf.length) throw new Error("bad label");
    labels.push(buf.subarray(cursor,cursor+len).toString("ascii"));
    cursor+=len; if(!jumped) consumed+=len;
  }
  return {name:(labels.join(".").toLowerCase()+".").replace(/^\.$/,"."),next:offset+consumed};
}
function writeName(name){
  const labels=String(name).replace(/\.$/,"").split(".").filter(Boolean), parts=[];
  for(const label of labels){ const b=Buffer.from(label,"ascii"); if(b.length>63) throw new Error("label too long"); parts.push(Buffer.from([b.length]),b); }
  parts.push(Buffer.from([0])); return Buffer.concat(parts);
}
function u16(n){const b=Buffer.alloc(2);b.writeUInt16BE(n&0xffff);return b;}
function u32(n){const b=Buffer.alloc(4);b.writeUInt32BE(Number(n)>>>0);return b;}
function ipv4(value){const p=String(value).split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))throw new Error("bad IPv4");return Buffer.from(p);}
function ipv6(value){
  let s=String(value).toLowerCase();
  if(s.includes(".")){const i=s.lastIndexOf(":");const v4=ipv4(s.slice(i+1));s=s.slice(0,i)+":"+(((v4[0]<<8)|v4[1]).toString(16))+":"+(((v4[2]<<8)|v4[3]).toString(16));}
  const h=s.split("::"); if(h.length>2) throw new Error("bad IPv6");
  const l=h[0]?h[0].split(":").filter(Boolean):[], r=h[1]?h[1].split(":").filter(Boolean):[], fill=8-l.length-r.length;
  if(fill<0 || (h.length===1&&fill!==0)) throw new Error("bad IPv6");
  const w=[...l,...Array(fill).fill("0"),...r].map(x=>parseInt(x||"0",16));
  if(w.length!==8||w.some(x=>!Number.isInteger(x)||x<0||x>65535)) throw new Error("bad IPv6");
  const b=Buffer.alloc(16); w.forEach((x,i)=>b.writeUInt16BE(x,i*2)); return b;
}
const TYPES={A:1,NS:2,CNAME:5,SOA:6,MX:15,TXT:16,AAAA:28,CAA:257};
function rdata(record,zone){
  if(record.type==="A") return ipv4(record.value);
  if(record.type==="AAAA") return ipv6(record.value);
  if(record.type==="NS"||record.type==="CNAME") return writeName(fqdn(record.value,zone.zone));
  if(record.type==="MX") return Buffer.concat([u16(record.priority),writeName(fqdn(record.value,zone.zone))]);
  if(record.type==="TXT"){const t=Buffer.from(String(record.value),"utf8"),chunks=[];for(let i=0;i<t.length;i+=255){const c=t.subarray(i,i+255);chunks.push(Buffer.from([c.length]),c);}return Buffer.concat(chunks.length?chunks:[Buffer.from([0])]);}
  if(record.type==="CAA"){const tag=Buffer.from(record.tag||"issue","ascii"),val=Buffer.from(String(record.value),"utf8");return Buffer.concat([Buffer.from([record.flags&255,tag.length]),tag,val]);}
  if(record.type==="SOA"){const s=zone.soa;return Buffer.concat([writeName(s.mname),writeName(s.rname),u32(s.serial),u32(s.refresh),u32(s.retry),u32(s.expire),u32(s.minimum)]);}
  throw new Error("unsupported");
}
function rr(record,zone,questionName){
  const owner=record.name===questionName?Buffer.from([0xc0,0x0c]):writeName(record.name);
  const data=rdata(record,zone);
  return Buffer.concat([owner,u16(TYPES[record.type]),u16(1),u32(record.ttl||zone.ttl),u16(data.length),data]);
}
function soaRecord(zone){return {name:zone.zone,type:"SOA",ttl:zone.ttl,value:""};}
function buildResponse(msg){
  if(msg.length<12) return null;
  const id=msg.readUInt16BE(0), reqFlags=msg.readUInt16BE(2), qd=msg.readUInt16BE(4);
  if(qd<1) return null;
  let q;
  try{const n=readName(msg,12);if(n.next+4>msg.length)return null;q={name:n.name,type:msg.readUInt16BE(n.next),class:msg.readUInt16BE(n.next+2),end:n.next+4};}catch{return null;}
  const question=msg.subarray(12,q.end);
  let zone; try{zone=loadZone();}catch{return null;}
  let rcode=0,answers=[],authority=[];
  const inZone=q.name===zone.zone||q.name.endsWith("."+zone.zone);
  if(!inZone||q.class!==1) rcode=5;
  else{
    const existing=zone.records.filter(r=>r.name===q.name);
    if(q.type===6&&q.name===zone.zone) answers=[soaRecord(zone)];
    else if(q.type===255) answers=existing;
    else{
      answers=existing.filter(r=>TYPES[r.type]===q.type);
      if(!answers.length){const c=existing.filter(r=>r.type==="CNAME");if(c.length)answers=c;}
      if(!existing.length&&q.name!==zone.zone) rcode=3;
      if(!answers.length) authority=[soaRecord(zone)];
    }
  }
  const ab=answers.map(r=>rr(r,zone,q.name)), aub=authority.map(r=>rr(r,zone,q.name)), header=Buffer.alloc(12);
  header.writeUInt16BE(id,0);header.writeUInt16BE(0x8400|(reqFlags&0x0100)|(rcode&15),2);header.writeUInt16BE(1,4);header.writeUInt16BE(ab.length,6);header.writeUInt16BE(aub.length,8);header.writeUInt16BE(0,10);
  return Buffer.concat([header,question,...ab,...aub]);
}
function equal(a,b){const aa=Buffer.from(typeof a==="string"?a:""),bb=Buffer.from(typeof b==="string"?b:"");return aa.length===bb.length&&timingSafeEqual(aa,bb);}

const udp=dgram.createSocket("udp4");
udp.on("message",(msg,rinfo)=>{const res=buildResponse(msg);if(res)udp.send(res,rinfo.port,rinfo.address);});
udp.on("error",e=>{console.error(e);process.exitCode=1;});
udp.bind(PORT,HOST,()=>console.log("IZAKHONO DNS UDP authoritative: "+HOST+":"+PORT));

let tcp=null;
if(TCP_ENABLED){
  tcp=net.createServer(socket=>{let pending=Buffer.alloc(0);socket.on("data",chunk=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=2){const len=pending.readUInt16BE(0);if(pending.length<2+len)break;const query=pending.subarray(2,2+len);pending=pending.subarray(2+len);const response=buildResponse(query);if(response)socket.write(Buffer.concat([u16(response.length),response]));}});});
  tcp.listen(PORT,HOST,()=>console.log("IZAKHONO DNS TCP authoritative: "+HOST+":"+PORT));
}
const control=http.createServer((req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{const z=loadZone();const body=JSON.stringify({product:"IZAKHONO DNS NODE",status:"healthy",authoritative:true,recursive:false,zone:z.zone,host:HOST,port:PORT,tcp:TCP_ENABLED});res.writeHead(200,{"content-type":"application/json","content-length":Buffer.byteLength(body),"cache-control":"no-store"});return res.end(body);}
    catch(error){const body=JSON.stringify({product:"IZAKHONO DNS NODE",status:"unhealthy",error:String(error.message||error)});res.writeHead(503,{"content-type":"application/json","content-length":Buffer.byteLength(body)});return res.end(body);}
  }
  if(!CONTROL_KEY||!equal(req.headers["x-izakhono-key"],CONTROL_KEY)){res.writeHead(401,{"content-type":"text/plain"});return res.end("Unauthorized");}
  if(req.method==="POST"&&req.url==="/v1/reload"){try{cached={mtime:0,zone:null};loadZone();res.writeHead(200);return res.end("reloaded");}catch(error){res.writeHead(500);return res.end(String(error.message||error));}}
  res.writeHead(404);res.end("Not found");
});
control.listen(CONTROL_PORT,CONTROL_HOST,()=>console.log("IZAKHONO DNS control: "+CONTROL_HOST+":"+CONTROL_PORT));

import { createServer } from "node:http";
import { readFile, stat, mkdir, appendFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));
const DATA_DIR = process.env.GOSPEL_TV_DATA_DIR || "/var/lib/izakhono-runtime/data/kora-gospel-tv";
const LIVE_EMBED_URL = process.env.GOSPEL_TV_LIVE_EMBED_URL || "";

const types = {
  ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".mp4":"video/mp4"
};

const rate = new Map();
function baseHeaders(type,length,cache="no-store"){
  return {
    "content-type":type,
    "content-length":length,
    "cache-control":cache,
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=()",
    "x-frame-options":"SAMEORIGIN",
    "content-security-policy":"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https:; media-src 'self' https: blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
  };
}
function send(res,status,body,type="text/plain; charset=utf-8",extra={}){
  const payload=Buffer.from(body);
  res.writeHead(status,{...baseHeaders(type,payload.length),...extra});
  res.end(payload);
}
function json(res,status,obj,extra={}){send(res,status,JSON.stringify(obj),"application/json; charset=utf-8",extra)}
async function readJson(req,limit=24_000){
  let size=0;const chunks=[];
  for await (const chunk of req){size+=chunk.length;if(size>limit) throw new Error("payload_too_large");chunks.push(chunk)}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
function clean(v,max=160){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function clientKey(req){return String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim()}
function allowed(req){
  const key=clientKey(req),now=Date.now(),windowMs=60*60*1000,max=12;
  const prev=rate.get(key)||[];const next=prev.filter(t=>now-t<windowMs);
  if(next.length>=max){rate.set(key,next);return false}
  next.push(now);rate.set(key,next);return true;
}
function validEmbed(url){
  if(!url) return "";
  try{const u=new URL(url);if(u.protocol!=="https:") return "";return u.toString()}catch{return ""}
}
async function saveSubmission(data,req){
  await mkdir(DATA_DIR,{recursive:true});
  const reference="KGT-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();
  const record={
    schema:"kora.gospel-tv.submission/v1",reference,created_at:new Date().toISOString(),
    category:clean(data.category,30),type:clean(data.type,50),name:clean(data.name,120),
    contact:clean(data.contact,160),message:clean(data.message,1600),on_air:Boolean(data.onAir),
    source_ip_hash:crypto.createHash("sha256").update(clientKey(req)+"|kora-gospel-tv").digest("hex").slice(0,20)
  };
  await appendFile(join(DATA_DIR,"submissions.ndjson"),JSON.stringify(record)+"\n",{encoding:"utf8",mode:0o600});
  return reference;
}

createServer(async (req,res)=>{
  const url=new URL(req.url||"/","http://localhost");

  if(url.pathname==="/health"||url.pathname==="/api/health"){
    return json(res,200,{ok:true,service:"kora-gospel-tv",product:"KORA GOSPEL TV",runtime:"izakhono-owned",version:"launch-1"});
  }

  if(url.pathname==="/api/channel" && req.method==="GET"){
    return json(res,200,{
      name:"KORA GOSPEL TV",
      promise:"Faith. Worship. Word. Africa to the World.",
      mode:validEmbed(LIVE_EMBED_URL)?"live-feed":"launch-mode",
      liveEmbedUrl:validEmbed(LIVE_EMBED_URL)
    });
  }

  if(url.pathname==="/api/submissions" && req.method==="POST"){
    if(!allowed(req)) return json(res,429,{error:"Too many submissions. Please try again later."},{"retry-after":"3600"});
    try{
      const data=await readJson(req);
      const category=clean(data.category,30);
      if(!["content","partner","prayer"].includes(category)) return json(res,400,{error:"Invalid submission category."});
      if(category!=="prayer" && (!clean(data.name,120)||!clean(data.contact,160))) return json(res,400,{error:"Name and contact details are required."});
      if(!clean(data.message,1600)) return json(res,400,{error:"Please add a message."});
      const reference=await saveSubmission(data,req);
      return json(res,201,{ok:true,reference});
    }catch(err){
      if(String(err?.message)==="payload_too_large") return json(res,413,{error:"Submission is too large."});
      return json(res,400,{error:"Unable to process this submission."});
    }
  }

  if(!["GET","HEAD"].includes(req.method||"GET")) return send(res,405,"Method not allowed");

  let pathname=decodeURIComponent(url.pathname);
  if(pathname==="/") pathname="/index.html";
  const safe=normalize(pathname).replace(/^([.][.][/\\])+/, "");
  const file=resolve(join(ROOT,safe));
  if(!file.startsWith(ROOT)) return send(res,403,"Forbidden");

  try{
    const s=await stat(file);if(!s.isFile()) throw new Error("not-file");
    const data=await readFile(file);const ext=extname(file).toLowerCase();
    res.writeHead(200,baseHeaders(types[ext]||"application/octet-stream",data.length,ext===".html"?"no-store":"public, max-age=3600"));
    if(req.method==="HEAD") return res.end();res.end(data);
  }catch{send(res,404,"Not found")}
}).listen(PORT,HOST,()=>console.log(`KORA GOSPEL TV listening on http://${HOST}:${PORT}`));

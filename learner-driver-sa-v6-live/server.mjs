#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=resolve(fileURLToPath(new URL(".",import.meta.url)));
const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 8786);
const SERVICE="learner-driver-sa";

const TYPES={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".ico":"image/x-icon",
  ".webmanifest":"application/manifest+json; charset=utf-8"
};

function headers(extra={}){
  return {
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=(), geolocation=()",
    "cache-control":"no-store",
    "x-izakhono-engine":SERVICE,
    ...extra
  };
}

function json(res,status,body){
  const payload=Buffer.from(JSON.stringify(body));
  res.writeHead(status,headers({"content-type":"application/json; charset=utf-8","content-length":payload.length}));
  res.end(payload);
}

function text(res,status,body){
  const payload=Buffer.from(body);
  res.writeHead(status,headers({"content-type":"text/plain; charset=utf-8","content-length":payload.length}));
  res.end(payload);
}

async function serve(req,res){
  const method=(req.method||"GET").toUpperCase();
  if(!["GET","HEAD"].includes(method)) return text(res,405,"Method not allowed");

  const url=new URL(req.url||"/","http://localhost");
  if(url.pathname==="/health"){
    return json(res,200,{
      ok:true,
      service:SERVICE,
      product:"Learner Driver SA",
      runtime:"izakhono-owned",
      engine_independent:true,
      tracking:"campaign-events-only",
      behavioural_tracking:false,
      generated_at:new Date().toISOString()
    });
  }

  let pathname;
  try{pathname=decodeURIComponent(url.pathname)}catch{return text(res,400,"Bad request")}
  if(pathname==="/") pathname="/index.html";
  if(pathname.includes("\0")) return text(res,400,"Bad request");

  const target=resolve(ROOT,"."+pathname);
  if(target!==ROOT && !target.startsWith(ROOT+sep)) return text(res,403,"Forbidden");

  let info;
  try{info=await stat(target)}catch{return text(res,404,"Not found")}
  if(!info.isFile()) return text(res,404,"Not found");

  try{
    const body=await readFile(target);
    const type=TYPES[extname(target).toLowerCase()]||"application/octet-stream";
    const cache=extname(target).toLowerCase()===".html"?"no-store":"public, max-age=300";
    res.writeHead(200,headers({"content-type":type,"content-length":body.length,"cache-control":cache}));
    if(method==="HEAD") return res.end();
    res.end(body);
  }catch{
    text(res,500,"Internal server error");
  }
}

createServer((req,res)=>{serve(req,res).catch(()=>text(res,500,"Internal server error"));})
  .listen(PORT,HOST,()=>console.log(`Learner Driver SA engine: http://${HOST}:${PORT}`));

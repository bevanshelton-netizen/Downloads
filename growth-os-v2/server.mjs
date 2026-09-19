import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 3000);
const ROOT=dirname(fileURLToPath(import.meta.url));

const types={
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".ico":"image/x-icon"
};

function headers(extra={}){
  return {
    "x-content-type-options":"nosniff",
    "x-frame-options":"SAMEORIGIN",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=(), geolocation=()",
    ...extra
  };
}

function sendJson(res,status,body){
  const payload=JSON.stringify(body);
  res.writeHead(status,headers({
    "content-type":"application/json; charset=utf-8",
    "content-length":Buffer.byteLength(payload),
    "cache-control":"no-store"
  }));
  res.end(payload);
}

const server=createServer(async(req,res)=>{
  try{
    if(req.method!=="GET" && req.method!=="HEAD"){
      res.writeHead(405,headers({"allow":"GET, HEAD"}));
      return res.end();
    }

    const url=new URL(req.url || "/","http://localhost");
    if(url.pathname==="/health"){
      return sendJson(res,200,{
        ok:true,
        service:"growth-os-v2",
        runtime:"izakhono-owned",
        deployment:process.env.IZAKHONO_DEPLOYMENT_ID || null
      });
    }

    let pathname=decodeURIComponent(url.pathname);
    if(pathname==="/") pathname="/index.html";
    const target=resolve(ROOT,"."+pathname);
    if(target!==ROOT && !target.startsWith(ROOT+sep)){
      res.writeHead(403,headers());
      return res.end("Forbidden");
    }

    let info;
    try{ info=await stat(target); }catch{
      res.writeHead(404,headers({"content-type":"text/plain; charset=utf-8"}));
      return res.end("Not found");
    }
    if(!info.isFile()){
      res.writeHead(404,headers());
      return res.end("Not found");
    }

    const body=await readFile(target);
    const contentType=types[extname(target).toLowerCase()] || "application/octet-stream";
    const cache=target.endsWith("index.html") ? "no-cache" : "public, max-age=3600";
    res.writeHead(200,headers({
      "content-type":contentType,
      "content-length":body.length,
      "cache-control":cache
    }));
    if(req.method==="HEAD") return res.end();
    res.end(body);
  }catch(error){
    sendJson(res,500,{ok:false,error:"INTERNAL_ERROR"});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO Growth OS v2 listening on http://${HOST}:${PORT}`);
});

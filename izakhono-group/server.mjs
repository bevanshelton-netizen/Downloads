import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=fileURLToPath(new URL(".",import.meta.url));
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||3000);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};

function send(res,status,body,type="text/plain; charset=utf-8"){
  const payload=Buffer.isBuffer(body)?body:Buffer.from(String(body));
  res.writeHead(status,{"content-type":type,"content-length":payload.length,"cache-control":status===200?"public, max-age=300":"no-store","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","x-izakhono-app":"flagship"});
  res.end(payload);
}

function safePath(urlPath){
  let decoded;
  try{decoded=decodeURIComponent(urlPath.split("?")[0]);}catch{return null}
  if(decoded==="/") decoded="/index.html";
  const cleaned=normalize(decoded).replace(/^([.][.][/\\])+/, "");
  const full=join(ROOT,cleaned.replace(/^[/\\]+/,""));
  if(!full.startsWith(ROOT)) return null;
  return full;
}

const server=createServer(async(req,res)=>{
  if(req.method!=="GET" && req.method!=="HEAD") return send(res,405,"Method not allowed");
  const path=(req.url||"/").split("?")[0];
  if(path==="/health"){
    return send(res,200,JSON.stringify({ok:true,service:"IZAKHONO FLAGSHIP",hostname:"izakhono.co.za",runtime:"izakhono-owned",version:"1.0.0"}),"application/json; charset=utf-8");
  }
  const file=safePath(req.url||"/");
  if(!file) return send(res,400,"Bad request");
  try{
    const info=await stat(file);
    if(!info.isFile()) return send(res,404,"Not found");
    const body=await readFile(file);
    if(req.method==="HEAD"){res.writeHead(200,{"content-type":types[extname(file).toLowerCase()]||"application/octet-stream","content-length":body.length});return res.end();}
    send(res,200,body,types[extname(file).toLowerCase()]||"application/octet-stream");
  }catch{send(res,404,"Not found");}
});

server.listen(PORT,HOST,()=>console.log(`IZAKHONO FLAGSHIP listening on http://${HOST}:${PORT}`));

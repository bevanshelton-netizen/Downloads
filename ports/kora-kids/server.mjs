import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));

const types = {
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

function headers(type,length,cache="no-store"){
  return {
    "content-type":type,
    "content-length":length,
    "cache-control":cache,
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=(), geolocation=()",
    "x-frame-options":"SAMEORIGIN"
  };
}
function send(res,status,body,type="text/plain; charset=utf-8"){
  const payload=Buffer.from(body);
  res.writeHead(status,headers(type,payload.length));
  res.end(payload);
}

createServer(async (req,res)=>{
  const url=new URL(req.url || "/","http://localhost");
  if(url.pathname==="/health" || url.pathname==="/api/health"){
    return send(res,200,JSON.stringify({
      ok:true,
      service:"kora-kids",
      product:"KORA KIDS — Tumi & Tala",
      runtime:"izakhono-owned",
      version:"season-1-engine"
    }),"application/json; charset=utf-8");
  }
  if(!["GET","HEAD"].includes(req.method || "GET")) return send(res,405,"Method not allowed");

  let pathname=decodeURIComponent(url.pathname);
  if(pathname==="/") pathname="/index.html";
  const safe=normalize(pathname).replace(/^([.][.][/\\])+/, "");
  const file=resolve(join(ROOT,safe));
  if(!file.startsWith(ROOT)) return send(res,403,"Forbidden");

  try{
    const s=await stat(file);
    if(!s.isFile()) throw new Error("not-file");
    const data=await readFile(file);
    const type=types[extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200,headers(type,data.length,extname(file)===".html"?"no-store":"public, max-age=3600"));
    if(req.method==="HEAD") return res.end();
    res.end(data);
  }catch{
    send(res,404,"Not found");
  }
}).listen(PORT,HOST,()=>{
  console.log(`KORA KIDS listening on http://${HOST}:${PORT}`);
});

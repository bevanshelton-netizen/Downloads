import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(new URL("./public/", import.meta.url).pathname);

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

function send(res,status,body,type="text/plain; charset=utf-8"){
  const payload=Buffer.from(body);
  res.writeHead(status,{
    "content-type":type,
    "content-length":payload.length,
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=(), geolocation=()"
  });
  res.end(payload);
}

createServer(async (req,res)=>{
  const url=new URL(req.url || "/","http://localhost");
  if(url.pathname==="/health" || url.pathname==="/api/health"){
    return send(res,200,JSON.stringify({
      ok:true,
      service:"memory-mania",
      product:"Memory Mania",
      runtime:"izakhono-owned",
      version:"public-beta-1"
    }),"application/json; charset=utf-8");
  }
  if(!["GET","HEAD"].includes(req.method || "GET")) return send(res,405,"Method not allowed");

  let pathname = decodeURIComponent(url.pathname);
  if(pathname==="/") pathname="/index.html";
  const safe = normalize(pathname).replace(/^([.][.][/\\])+/, "");
  const file = resolve(join(ROOT, safe));
  if(!file.startsWith(ROOT)) return send(res,403,"Forbidden");

  try{
    const s=await stat(file);
    if(!s.isFile()) throw new Error("not-file");
    const data=await readFile(file);
    res.writeHead(200,{
      "content-type":types[extname(file).toLowerCase()] || "application/octet-stream",
      "content-length":data.length,
      "cache-control": extname(file)===".html" ? "no-store" : "public, max-age=3600",
      "x-content-type-options":"nosniff",
      "referrer-policy":"strict-origin-when-cross-origin",
      "permissions-policy":"camera=(), microphone=(), geolocation=()"
    });
    if(req.method==="HEAD") return res.end();
    res.end(data);
  }catch{
    send(res,404,"Not found");
  }
}).listen(PORT,HOST,()=>{
  console.log(`Memory Mania listening on http://${HOST}:${PORT}`);
});

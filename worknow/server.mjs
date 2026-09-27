import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {extname,join,normalize} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=fileURLToPath(new URL(".",import.meta.url));
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||3000);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp"};
function headers(type,len){return {"content-type":type,"content-length":len,"x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()","content-security-policy":"default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://wa.me;","cache-control":"public, max-age=300"}}
function send(res,status,body,type="text/plain; charset=utf-8"){const b=Buffer.isBuffer(body)?body:Buffer.from(String(body));res.writeHead(status,headers(type,b.length));res.end(b)}
function safePath(raw){let p;try{p=decodeURIComponent(String(raw||"/").split("?")[0])}catch{return null}if(p==="/")p="/index.html";const clean=normalize(p).replace(/^([.][.][/\\])+/,"").replace(/^[/\\]+/,"");const full=join(ROOT,clean);return full.startsWith(ROOT)?full:null}
createServer(async(req,res)=>{if(req.method!=="GET"&&req.method!=="HEAD")return send(res,405,"Method not allowed");if((req.url||"").split("?")[0]==="/health")return send(res,200,JSON.stringify({ok:true,service:"worknow",runtime:"izakhono-owned",version:"1.0.0"}),"application/json; charset=utf-8");const file=safePath(req.url);if(!file)return send(res,400,"Bad request");try{const s=await stat(file);if(!s.isFile())throw new Error();const body=await readFile(file);if(req.method==="HEAD"){res.writeHead(200,headers(types[extname(file)]||"application/octet-stream",body.length));return res.end()}send(res,200,body,types[extname(file)]||"application/octet-stream")}catch{send(res,404,"Not found")}}).listen(PORT,HOST,()=>console.log(`WorkNow listening on http://${HOST}:${PORT}`));

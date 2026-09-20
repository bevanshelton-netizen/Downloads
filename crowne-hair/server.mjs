import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8080);
const ROOT=resolve(new URL("./public/",import.meta.url).pathname);
const CHECKOUT_URL=process.env.IKHOKHA_HAIR_CHECKOUT_URL||"";
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};
function send(res,status,body,type="text/plain; charset=utf-8",headers={}){const payload=Buffer.from(body);res.writeHead(status,{"content-type":type,"content-length":payload.length,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()",...headers});res.end(payload)}
createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  if(url.pathname==="/health"||url.pathname==="/api/health")return send(res,200,JSON.stringify({ok:true,service:"crowne-hair",product:"CROWNÉ Hair",runtime:"izakhono-owned",checkoutConfigured:Boolean(CHECKOUT_URL),version:"1.0.0"}),"application/json; charset=utf-8");
  if(url.pathname==="/api/config")return send(res,200,JSON.stringify({checkoutConfigured:Boolean(CHECKOUT_URL),paymentProvider:CHECKOUT_URL?"iKhokha":null}),"application/json; charset=utf-8");
  if(url.pathname==="/checkout"){
    if(!CHECKOUT_URL){
      const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CROWNÉ Hair Checkout</title><style>body{margin:0;background:#140a10;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:620px;padding:48px;background:#24111e;border:1px solid #cba66c;border-radius:24px;text-align:center}h1{font-family:Georgia,serif;font-size:44px;margin:0 0 16px;color:#f5d7a1}p{line-height:1.6;color:#e8d9e3}a{display:inline-block;margin-top:18px;color:#140a10;background:#f5d7a1;padding:14px 20px;border-radius:999px;text-decoration:none;font-weight:700}</style></head><body><div class="box"><h1>Your crown is reserved.</h1><p>The catalogue is live, but the secure iKhokha hair checkout URL has not yet been connected to this storefront. No payment has been taken.</p><a href="/">Return to CROWNÉ Hair</a></div></body></html>';
      return send(res,503,html,"text/html; charset=utf-8");
    }
    const target=new URL(CHECKOUT_URL),sku=url.searchParams.get("sku");if(sku)target.searchParams.set("reference",sku);res.writeHead(302,{location:target.toString(),"cache-control":"no-store"});return res.end();
  }
  if(!["GET","HEAD"].includes(req.method||"GET"))return send(res,405,"Method not allowed");
  let pathname=decodeURIComponent(url.pathname);if(pathname==="/")pathname="/index.html";
  const safe=normalize(pathname).replace(/^([.][.][/\\])+/,""),file=resolve(join(ROOT,safe));if(!file.startsWith(ROOT))return send(res,403,"Forbidden");
  try{const s=await stat(file);if(!s.isFile())throw new Error("not-file");const data=await readFile(file);res.writeHead(200,{"content-type":types[extname(file).toLowerCase()]||"application/octet-stream","content-length":data.length,"cache-control":extname(file)===".html"?"no-store":"public, max-age=3600","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()"});if(req.method==="HEAD")return res.end();res.end(data)}catch{send(res,404,"Not found")}
}).listen(PORT,HOST,()=>console.log("CROWNÉ Hair listening on http://"+HOST+":"+PORT));

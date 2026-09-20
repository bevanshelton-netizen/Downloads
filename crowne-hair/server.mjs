import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8080);
const ROOT=resolve(new URL("./public/",import.meta.url).pathname);
const PAY_ORIGIN=process.env.IZAKHONO_PAY_ORIGIN||"http://127.0.0.1:8080";
const PAY_HOST=process.env.IZAKHONO_PAY_HOST||"pay.izakhonoafrica.co.za";
const PAY_KEY=process.env.IZAKHONO_PAY_APP_KEY||"";\nconst DIRECT_CHECKOUT=/^(1|true|yes|on)$/i.test(process.env.CROWNE_HAIR_DIRECT_CHECKOUT||"false");
const APP_SLUG="crowne-hair";
const skuMap={
  "CRN-VELVET-CURL":"velvet-curl",
  "CRN-BODY-WAVE":"bombshell-body",
  "CRN-BUNDLE-BAR":"signature-bundles",
  "CRN-SLEEK-BOB":"after-dark-bob",
  "CRN-CLOSURE":"melted-closure",
  "CRN-FRONTAL":"spotlight-frontal",
  "CRN-PONY":"power-pony",
  "CRN-TEXTURE":"texture-edit"
};
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};

function send(res,status,body,type="text/plain; charset=utf-8",headers={}){const payload=Buffer.from(body);res.writeHead(status,{"content-type":type,"content-length":payload.length,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()",...headers});res.end(payload)}
function sendJson(res,status,value){send(res,status,JSON.stringify(value),"application/json; charset=utf-8")}
async function readJson(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>16384)throw new Error("request too large");chunks.push(chunk)}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
function payRequest(path,payload){
  return new Promise((resolve,reject)=>{
    const origin=new URL(PAY_ORIGIN),body=Buffer.from(JSON.stringify(payload));
    const transport=origin.protocol==="https:"?httpsRequest:httpRequest;
    const req=transport({protocol:origin.protocol,hostname:origin.hostname,port:origin.port||undefined,path,method:"POST",headers:{"Host":PAY_HOST,"Content-Type":"application/json","Content-Length":body.length,"x-izakhono-app":APP_SLUG,"x-izakhono-key":PAY_KEY}},resp=>{
      const chunks=[];resp.on("data",c=>chunks.push(c));resp.on("end",()=>{const raw=Buffer.concat(chunks).toString("utf8");let data;try{data=JSON.parse(raw||"{}")}catch{data={error:"invalid gateway response"}}resolve({status:resp.statusCode||502,data})});
    });
    req.setTimeout(15000,()=>req.destroy(new Error("payment gateway timeout")));req.on("error",reject);req.end(body);
  });
}
function cleanName(v){return typeof v==="string"?v.trim().replace(/\s+/g," ").slice(0,100):""}
function cleanEmail(v){const x=typeof v==="string"?v.trim().toLowerCase():"";return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)?x:""}

createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  if(url.pathname==="/health"||url.pathname==="/api/health")return sendJson(res,200,{ok:true,service:"crowne-hair",product:"CROWNÉ Hair",runtime:"izakhono-owned",checkoutConfigured:Boolean(PAY_KEY&&DIRECT_CHECKOUT),paymentBackbone:"IZAKHONO PAY",version:"1.2.0"});
  if(url.pathname==="/api/config")return sendJson(res,200,{checkoutConfigured:Boolean(PAY_KEY&&DIRECT_CHECKOUT),paymentProvider:PAY_KEY&&DIRECT_CHECKOUT?"iKhokha via IZAKHONO PAY":null,reservationFirst:!DIRECT_CHECKOUT});\n  if(url.pathname==="/payment/return"){const order=(url.searchParams.get("order")||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,100),payment=(url.searchParams.get("payment")||"pending").replace(/[^a-z]/gi,"").slice(0,20);const msg=payment==="success"?"Payment submitted. We will complete the order only after secure provider confirmation.":payment==="failed"?"Payment was not completed. No order will be fulfilled until payment is verified.":payment==="cancelled"?"Checkout was cancelled. You can return to CROWNÉ and try again.":"Payment status received.";return send(res,200,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CROWNÉ Hair | Payment</title></head><body style="margin:0;background:#140a10;color:#fff;font-family:system-ui"><main style="max-width:720px;margin:12vh auto;padding:32px"><p style="color:#f4d69b;letter-spacing:.14em;font-weight:800">CROWNÉ HAIR</p><h1 style="font-family:Georgia,serif;font-size:48px">${msg}</h1><p>Order reference: ${order||"not supplied"}</p><p><a href="/" style="color:#f4d69b">Return to CROWNÉ Hair</a></p></main></body></html>`,"text/html; charset=utf-8")};
  if(url.pathname==="/api/checkout"&&req.method==="POST"){
    if(!PAY_KEY)return sendJson(res,503,{error:"CROWNÉ Hair payment key is not configured on the owner host"});\n    if(!DIRECT_CHECKOUT)return sendJson(res,409,{error:"Direct checkout is paused until stock, specification, delivery and final price are confirmed"});
    try{
      const body=await readJson(req),product_code=skuMap[String(body.sku||"")],customer_name=cleanName(body.customer_name),customer_email=cleanEmail(body.customer_email);
      if(!product_code)return sendJson(res,400,{error:"Unknown product"});
      if(!customer_name)return sendJson(res,400,{error:"Please enter your name"});
      if(!customer_email)return sendJson(res,400,{error:"Please enter a valid email address"});
      const result=await payRequest("/api/v1/orders",{product_code,customer_name,customer_email,customer_reference:String(body.sku||"")});
      return sendJson(res,result.status,result.data);
    }catch(err){return sendJson(res,502,{error:"Secure checkout could not be started",detail:String(err&&err.message||err)})}
  }
  if(!["GET","HEAD"].includes(req.method||"GET"))return send(res,405,"Method not allowed");
  let pathname=decodeURIComponent(url.pathname);if(pathname==="/")pathname="/index.html";
  const safe=normalize(pathname).replace(/^([.][.][/\\])+/,""),file=resolve(join(ROOT,safe));if(!file.startsWith(ROOT))return send(res,403,"Forbidden");
  try{const s=await stat(file);if(!s.isFile())throw new Error("not-file");const data=await readFile(file);res.writeHead(200,{"content-type":types[extname(file).toLowerCase()]||"application/octet-stream","content-length":data.length,"cache-control":extname(file)===".html"?"no-store":"public, max-age=3600","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()"});if(req.method==="HEAD")return res.end();res.end(data)}catch{send(res,404,"Not found")}
}).listen(PORT,HOST,()=>console.log("CROWNÉ Hair listening on http://"+HOST+":"+PORT));

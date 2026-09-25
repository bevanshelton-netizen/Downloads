import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname=dirname(fileURLToPath(import.meta.url));
const BUILDER=readFileSync(join(__dirname,"public","index.html"),"utf8");
const STATIC_PAGES={
  "/terms":readFileSync(join(__dirname,"public","terms.html"),"utf8"),
  "/privacy":readFileSync(join(__dirname,"public","privacy.html"),"utf8"),
  "/refund":readFileSync(join(__dirname,"public","refund.html"),"utf8"),
  "/payment-result":readFileSync(join(__dirname,"public","payment-result.html"),"utf8")
};
const SUPA=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const KEY=process.env.SUPABASE_PUBLISHABLE_KEY||"";
const PORT=Number(process.env.PORT||8080);

function send(res,status,type,body,extra={}){
  res.writeHead(status,{"content-type":type,"x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()",...extra});
  res.end(body);
}
function cleanSlug(v){const s=String(v||"").toLowerCase().trim();return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)?s:"";}
async function site(slug,res){
  if(!SUPA||!KEY)return send(res,503,"text/plain; charset=utf-8","Owned runtime is missing Supabase configuration.");
  const url=SUPA+"/rest/v1/sites?slug=eq."+encodeURIComponent(slug)+"&status=eq.published&select=generated_html,name&limit=1";
  try{
    const r=await fetch(url,{headers:{apikey:KEY,accept:"application/json"}});
    if(!r.ok)return send(res,502,"text/plain; charset=utf-8","Site lookup failed");
    const rows=await r.json(),row=Array.isArray(rows)?rows[0]:null;
    if(!row?.generated_html)return send(res,404,"text/html; charset=utf-8","<!doctype html><html><body><h1>Website not published yet</h1></body></html>",{"cache-control":"no-store"});
    return send(res,200,"text/html; charset=utf-8",row.generated_html,{"cache-control":"public, max-age=60, stale-while-revalidate=600"});
  }catch(_e){return send(res,500,"text/plain; charset=utf-8","Unexpected server error");}
}
http.createServer(async(req,res)=>{
  const u=new URL(req.url||"/","http://localhost");
  if(u.pathname==="/health")return send(res,200,"application/json; charset=utf-8",JSON.stringify({ok:true,service:"IZAKHONO WebStart Owned Runtime",version:"2.0.0"}),{"cache-control":"no-store"});
  if(u.pathname==="/"||u.pathname==="/builder")return send(res,200,"text/html; charset=utf-8",BUILDER,{"cache-control":"public, max-age=60"});
  if(STATIC_PAGES[u.pathname])return send(res,200,"text/html; charset=utf-8",STATIC_PAGES[u.pathname],{"cache-control":"public, max-age=300"});
  const m=u.pathname.match(/^\/sites\/([a-z0-9-]+)$/);
  if(m){const slug=cleanSlug(m[1]);if(!slug)return send(res,400,"text/plain; charset=utf-8","Invalid slug");return site(slug,res);}
  return send(res,404,"text/plain; charset=utf-8","Not found");
}).listen(PORT,"0.0.0.0",()=>console.log("WebStart owned runtime listening on",PORT));
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8890);
const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));
const REPO = resolve(ROOT, "..");
const WORKSPACE = resolve(process.env.KORA_KIDS_STUDIO_WORKSPACE || join(homedir(), ".izakhono", "kora-kids-studio"));
const JOBS = join(WORKSPACE, "jobs");

const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

async function json(path){return JSON.parse(await readFile(path,"utf8"))}
function send(res,status,body,type="application/json; charset=utf-8"){
 const payload=Buffer.from(typeof body==="string"?body:JSON.stringify(body));
 res.writeHead(status,{"content-type":type,"content-length":payload.length,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()","x-frame-options":"DENY"});
 res.end(payload);
}
async function readBody(req){
 const chunks=[];let total=0;
 for await (const c of req){total+=c.length;if(total>262144)throw new Error("body-too-large");chunks.push(c)}
 return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
async function catalog(){
 const [season,languages,targets,template]=await Promise.all([
  json(join(REPO,"ports","kora-kids","season-1.json")),
  json(join(REPO,"ports","kora-kids","languages.json")),
  json(join(ROOT,"config","render-targets.json")),
  json(join(ROOT,"templates","episode-template.json"))
 ]);
 return {season,languages,targets,template};
}
async function listJobs(){
 await mkdir(JOBS,{recursive:true});
 const names=(await readdir(JOBS)).filter(x=>x.endsWith(".json"));
 const out=[];
 for(const n of names){try{out.push(await json(join(JOBS,n)))}catch{}}
 return out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
function safeId(x){return /^[a-f0-9-]{36}$/i.test(x)}
async function updateJob(id,fn){
 if(!safeId(id))throw new Error("bad-id");
 const path=join(JOBS,id+".json");
 const job=await json(path); const next=fn(job);
 next.updatedAt=new Date().toISOString();
 await writeFile(path,JSON.stringify(next,null,2)+"\n");
 return next;
}

createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||"/","http://localhost");
  if(url.pathname==="/health") return send(res,200,{ok:true,service:"kora-kids-studio",runtime:"izakhono-owner-local",version:"factory-1",public:false});
  if(url.pathname==="/api/catalog"&&req.method==="GET") return send(res,200,await catalog());
  if(url.pathname==="/api/jobs"&&req.method==="GET") return send(res,200,{jobs:await listJobs()});
  if(url.pathname==="/api/jobs"&&req.method==="POST"){
   const input=await readBody(req); const c=await catalog();
   const ep=c.season.episodes.find(x=>x.slug===input.episodeSlug);
   const lang=c.languages.languages.find(x=>x.code===input.language);
   const target=c.targets.targets.find(x=>x.id===input.renderTarget&&x.enabled);
   if(!ep||!lang||!target) return send(res,400,{ok:false,error:"invalid episode, language or enabled render target"});
   if(lang.status!=="live") return send(res,409,{ok:false,error:"language edition is not reviewed/live yet",language:lang.name,status:lang.status});
   const id=randomUUID();
   const job={id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:"draft",publishable:false,episode:{number:ep.number,slug:ep.slug,title:ep.title,theme:ep.theme,learning:ep.learning},language:{code:lang.code,name:lang.name,voice:lang.voice},renderTarget:{id:target.id,label:target.label,mode:target.mode},outputs:c.template.outputs,scenes:c.template.scenes,review:{script:false,language:false,childSafety:false,brand:false,final:false}};
   await mkdir(JOBS,{recursive:true}); await writeFile(join(JOBS,id+".json"),JSON.stringify(job,null,2)+"\n");
   return send(res,201,{ok:true,job});
  }
  const reviewMatch=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})\/review$/i);
  if(reviewMatch&&req.method==="POST"){
   const input=await readBody(req); const allowed=["script","language","childSafety","brand","final"];
   if(!allowed.includes(input.gate)||typeof input.approved!=="boolean") return send(res,400,{ok:false,error:"invalid review gate"});
   const next=await updateJob(reviewMatch[1],job=>{
    job.review[input.gate]=input.approved;
    job.publishable=Object.values(job.review).every(Boolean);
    job.status=job.publishable?"approved":"review";
    return job;
   });
   return send(res,200,{ok:true,job:next});
  }
  if(!["GET","HEAD"].includes(req.method||"GET")) return send(res,405,{ok:false,error:"method not allowed"});
  let p=decodeURIComponent(url.pathname); if(p==="/")p="/index.html";
  const file=resolve(join(ROOT,"."+p));
  if(!file.startsWith(ROOT))return send(res,403,{ok:false,error:"forbidden"});
  try{
   const data=await readFile(file); const type=types[extname(file)]||"application/octet-stream";
   res.writeHead(200,{"content-type":type,"content-length":data.length,"cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY"});
   if(req.method==="HEAD")return res.end(); res.end(data);
  }catch{return send(res,404,{ok:false,error:"not found"})}
 }catch(e){return send(res,500,{ok:false,error:e?.message||"studio error"})}
}).listen(PORT,HOST,async()=>{
 await mkdir(JOBS,{recursive:true});
 console.log(`KORA KIDS Animation Factory listening on http://${HOST}:${PORT}`);
 console.log(`Workspace: ${WORKSPACE}`);
});

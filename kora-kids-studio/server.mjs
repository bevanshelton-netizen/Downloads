import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8890);
const ROOT = resolve(fileURLToPath(new URL("./", import.meta.url)));
const REPO = resolve(ROOT, "..");
const WORKSPACE = resolve(process.env.KORA_KIDS_STUDIO_WORKSPACE || join(homedir(), ".izakhono", "kora-kids-studio"));
const JOBS = join(WORKSPACE, "jobs");
const RENDERS = join(WORKSPACE, "renders");
const AUDIO_ASSETS = join(WORKSPACE, "audio-assets");
const LOCALISATION_PACKS = join(REPO, "kora-kids-localisation", "packs");
const LOCALISATION_REVIEWS = join(WORKSPACE, "localisations");
const RELEASES = join(WORKSPACE, "releases");
const FINISHED = join(WORKSPACE, "finished");
const RENDER_WORKER = join(REPO, "kora-kids-render-worker", "worker.mjs");

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
async function productionPack(seriesId,slug,language){
 const path=join(ROOT,"production",seriesId,slug+"."+language+".json");
 if(!existsSync(path)) return null;
 const pack=await json(path);
 if(pack?.series?.id!==seriesId||pack?.episode?.slug!==slug||pack?.language?.code!==language) throw new Error("production-pack-mismatch");
 return pack;
}
async function catalog(){
 const [network,leboSeason,tumiSeason,languages,targets,leboTemplate,tumiTemplate]=await Promise.all([
  json(join(REPO,"ports","kora-kids","network.json")),
  json(join(REPO,"ports","kora-kids","lebo-jabu-season-1.json")),
  json(join(REPO,"ports","kora-kids","season-1.json")),
  json(join(REPO,"ports","kora-kids","languages.json")),
  json(join(ROOT,"config","render-targets.json")),
  json(join(ROOT,"templates","lebo-jabu-episode-template.json")),
  json(join(ROOT,"templates","episode-template.json"))
 ]);
 const series=[
  {id:"lebo-jabu",title:"Lebo & Jabu",flagship:true,season:leboSeason,template:leboTemplate,rigs:["lebo.svg","jabu.svg"]},
  {id:"tumi-tala",title:"Tumi & Tala",flagship:false,season:tumiSeason,template:tumiTemplate,rigs:["tumi.svg","tala.svg","piko.svg","busi-bus.svg"]}
 ];
 const defaultSeries=network.flagship||"lebo-jabu";
 const active=series.find(x=>x.id===defaultSeries)||series[0];
 return {network,series,defaultSeries,languages,targets,season:active.season,template:active.template};
}
async function listJobs(){
 await mkdir(JOBS,{recursive:true});
 await mkdir(RENDERS,{recursive:true});
 await mkdir(AUDIO_ASSETS,{recursive:true});
 await mkdir(LOCALISATION_REVIEWS,{recursive:true});
 await mkdir(RELEASES,{recursive:true});
 await mkdir(FINISHED,{recursive:true});
 const names=(await readdir(JOBS)).filter(x=>x.endsWith(".json"));
 const out=[];
 for(const n of names){try{out.push(await json(join(JOBS,n)))}catch{}}
 return out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
async function listAudioAssets(){
 await mkdir(AUDIO_ASSETS,{recursive:true});
 const entries=await readdir(AUDIO_ASSETS,{withFileTypes:true});
 const out=[];
 for(const e of entries){
  if(!e.isDirectory()||!safeId(e.name))continue;
  try{
   const asset=await json(join(AUDIO_ASSETS,e.name,"manifest.json"));
   const safe={...asset}; delete safe.privateAssetPath;
   out.push(safe);
  }catch{}
 }
 return out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
async function updateAudioAsset(id,fn){
 if(!safeId(id))throw new Error("bad-id");
 const path=join(AUDIO_ASSETS,id,"manifest.json");
 const asset=await json(path);const next=fn(asset);
 next.updatedAt=new Date().toISOString();
 await writeFile(path,JSON.stringify(next,null,2)+"\n");
 const safe={...next};delete safe.privateAssetPath;return safe;
}
function safeLang(x){return /^[A-Za-z0-9-]{2,12}$/.test(x)}
async function localisationBasePacks(){
 if(!existsSync(LOCALISATION_PACKS)) return [];
 const names=(await readdir(LOCALISATION_PACKS)).filter(x=>x.endsWith(".json"));
 const out=[];
 for(const n of names){try{out.push(await json(join(LOCALISATION_PACKS,n)))}catch{}}
 return out;
}
async function listLocalisations(){
 await mkdir(LOCALISATION_REVIEWS,{recursive:true});
 const packs=await localisationBasePacks(),out=[];
 for(const pack of packs){
   const reviewPath=join(LOCALISATION_REVIEWS,pack.targetLanguage+".json");
   let state=null;
   if(existsSync(reviewPath)){try{state=await json(reviewPath)}catch{}}
   const review=state?.review||pack.review||{};
   out.push({
     targetLanguage:pack.targetLanguage,targetName:pack.targetName,region:pack.region,voice:pack.voice,
     textDirection:pack.textDirection,status:pack.status,lineCount:pack.lines?.length||0,
     review,approvedForDubbing:state?.approvedForDubbing===true,approvedForPublication:false,
     humanReviewRequired:true,translationOrigin:pack.translationOrigin
   });
 }
 return out.sort((a,b)=>a.targetName.localeCompare(b.targetName));
}
async function updateLocalisationReview(code,gate,approved){
 if(!safeLang(code))throw new Error("bad-language");
 const packs=await localisationBasePacks();
 const pack=packs.find(x=>x.targetLanguage===code);
 if(!pack)throw new Error("unknown-language");
 const allowed=["nativeLanguage","culturalContext","comicTiming","childSafety","factAccuracy","finalEditorial"];
 if(!allowed.includes(gate)||typeof approved!=="boolean")throw new Error("invalid-localisation-review");
 await mkdir(LOCALISATION_REVIEWS,{recursive:true});
 const path=join(LOCALISATION_REVIEWS,code+".json");
 let state={targetLanguage:code,review:{...pack.review},approvedForDubbing:false,approvedForPublication:false};
 if(existsSync(path)){try{state=await json(path)}catch{}}
 state.review=state.review||{...pack.review};
 state.review[gate]=approved;
 state.approvedForDubbing=allowed.every(k=>state.review[k]===true);
 state.approvedForPublication=false;
 state.updatedAt=new Date().toISOString();
 await writeFile(path,JSON.stringify(state,null,2)+"\n");
 return {...state,targetName:pack.targetName,region:pack.region,voice:pack.voice,textDirection:pack.textDirection,status:pack.status};
}
async function listFinishingPackages(){
 await mkdir(FINISHED,{recursive:true});
 const entries=await readdir(FINISHED,{withFileTypes:true});
 const out=[];
 for(const e of entries){
  if(!e.isDirectory())continue;
  const resultPath=join(FINISHED,e.name,"finishing-result.json");
  if(!existsSync(resultPath))continue;
  try{out.push(await json(resultPath))}catch{}
 }
 return out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
async function listReleases(){
 await mkdir(RELEASES,{recursive:true});
 const entries=await readdir(RELEASES,{withFileTypes:true});
 const out=[];
 for(const e of entries){
  if(!e.isDirectory())continue;
  const resultPath=join(RELEASES,e.name,"release-package.json");
  if(!existsSync(resultPath))continue;
  try{out.push(await json(resultPath))}catch{}
 }
 return out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
async function listRenders(){
 await mkdir(RENDERS,{recursive:true});
 const entries=await readdir(RENDERS,{withFileTypes:true});
 const out=[];
 for(const e of entries){
  if(!e.isDirectory()||!safeId(e.name))continue;
  try{out.push(await json(join(RENDERS,e.name,"status.json")))}catch{}
 }
 return out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
async function writeRenderStatus(dir,status){
 status.updatedAt=new Date().toISOString();
 await writeFile(join(dir,"status.json"),JSON.stringify(status,null,2)+"\n");
}
async function startRender(jobId,mode){
 if(!safeId(jobId))throw new Error("bad-id");
 if(!["proof","production"].includes(mode))throw new Error("invalid-render-mode");
 if(!existsSync(RENDER_WORKER))throw new Error("render-worker-missing");
 const jobPath=join(JOBS,jobId+".json");
 const job=await json(jobPath);
 if(job.status!=="approved"||job.publishable!==true)throw new Error("job-not-approved");
 if(!["lebo-jabu","tumi-tala"].includes(job.series?.id))throw new Error("series-render-worker-not-ready");
 if(job.renderTarget?.id!=="izakhono-local"||job.renderTarget?.mode!=="owned")throw new Error("job-not-owned-render");
 const id=randomUUID(),dir=join(RENDERS,id);
 await mkdir(dir,{recursive:true});
 const status={id,jobId,mode,status:"queued",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),series:job.series,episode:job.episode,language:job.language,outputDir:dir,broadcastMaster:false};
 await writeRenderStatus(dir,status);
 const log=createWriteStream(join(dir,"worker.log"),{flags:"a"});
 const child=spawn(process.execPath,[RENDER_WORKER,"--input",jobPath,"--output",dir,"--mode",mode],{cwd:REPO,windowsHide:true,stdio:["ignore","pipe","pipe"]});
 child.stdout.pipe(log);child.stderr.pipe(log);
 status.status="running";status.pid=child.pid;await writeRenderStatus(dir,status);
 child.on("error",async err=>{status.status="failed";status.error=err.message;delete status.pid;try{await writeRenderStatus(dir,status)}catch{}});
 child.on("close",async code=>{
  delete status.pid;status.exitCode=code;
  if(code===0){
   status.status="completed";
   try{status.result=await json(join(dir,"render-result.json"))}catch{status.status="failed";status.error="render-result-missing"}
  }else{status.status="failed";status.error="render-worker-exit-"+code}
  try{await writeRenderStatus(dir,status)}catch{}
  log.end();
 });
 return status;
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
  if(url.pathname==="/health") return send(res,200,{ok:true,service:"kora-kids-studio",runtime:"izakhono-owner-local",version:"factory-9",public:false});
  if(url.pathname==="/api/catalog"&&req.method==="GET") return send(res,200,await catalog());
  if(url.pathname==="/api/jobs"&&req.method==="GET") return send(res,200,{jobs:await listJobs()});
  if(url.pathname==="/api/renders"&&req.method==="GET") return send(res,200,{renders:await listRenders()});
  if(url.pathname==="/api/audio-assets"&&req.method==="GET") return send(res,200,{assets:await listAudioAssets()});
  if(url.pathname==="/api/localisations"&&req.method==="GET") return send(res,200,{localisations:await listLocalisations()});
  if(url.pathname==="/api/releases"&&req.method==="GET") return send(res,200,{releases:await listReleases()});
  if(url.pathname==="/api/finishing"&&req.method==="GET") return send(res,200,{finishing:await listFinishingPackages()});
  if(url.pathname==="/api/jobs"&&req.method==="POST"){
   const input=await readBody(req); const c=await catalog();
   const series=c.series.find(x=>x.id===(input.seriesId||c.defaultSeries));
   const ep=series?.season.episodes.find(x=>x.slug===input.episodeSlug);
   const lang=c.languages.languages.find(x=>x.code===input.language);
   const target=c.targets.targets.find(x=>x.id===input.renderTarget&&x.enabled);
   if(!series||!ep||!lang||!target) return send(res,400,{ok:false,error:"invalid series, episode, language or enabled render target"});
   if(lang.status!=="live") return send(res,409,{ok:false,error:"language edition is not reviewed/live yet",language:lang.name,status:lang.status});
   const pack=await productionPack(series.id,ep.slug,lang.code);
   const id=randomUUID();
   const job={id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:"draft",publishable:false,series:{id:series.id,title:series.title},episode:{number:ep.number,slug:ep.slug,title:ep.title,theme:ep.theme,learning:pack?.learningObjectives||ep.learning},language:{code:lang.code,name:lang.name,voice:lang.voice,finalVoiceApproved:pack?.language?.finalVoiceApproved===true},renderTarget:{id:target.id,label:target.label,mode:target.mode},outputs:series.template.outputs,scenes:pack?.scenes||series.template.scenes,productionPack:pack?{schema:pack.schema,status:pack.status,targetDurationSeconds:pack.targetDurationSeconds,factNotes:pack.factNotes,musicDirection:pack.musicDirection,qualityBibles:pack.qualityBibles,performanceLocks:pack.performanceLocks,reviewState:pack.reviewState}:null,review:{...series.template.review}};
   await mkdir(JOBS,{recursive:true}); await writeFile(join(JOBS,id+".json"),JSON.stringify(job,null,2)+"\n");
   return send(res,201,{ok:true,job});
  }
  const audioReviewMatch=url.pathname.match(/^\/api\/audio-assets\/([a-f0-9-]{36})\/review$/i);
  if(audioReviewMatch&&req.method==="POST"){
   const input=await readBody(req);
   const allowed=["performance","technical","rights","final"];
   if(!allowed.includes(input.gate)||typeof input.approved!=="boolean") return send(res,400,{ok:false,error:"invalid audio review gate"});
   try{
    const asset=await updateAudioAsset(audioReviewMatch[1],x=>{
      x.review=x.review||{performance:false,technical:false,rights:false,final:false};
      x.review[input.gate]=input.approved;
      x.approvedForMastering=Object.values(x.review).every(Boolean);
      return x;
    });
    return send(res,200,{ok:true,asset});
   }catch(e){return send(res,400,{ok:false,error:e?.message||"audio review failed"})}
  }
  const localisationReviewMatch=url.pathname.match(/^\/api\/localisations\/([A-Za-z0-9-]{2,12})\/review$/);
  if(localisationReviewMatch&&req.method==="POST"){
   const input=await readBody(req);
   try{return send(res,200,{ok:true,localisation:await updateLocalisationReview(localisationReviewMatch[1],input.gate,input.approved)})}
   catch(e){return send(res,400,{ok:false,error:e?.message||"localisation review failed"})}
  }
  const renderMatch=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})\/render$/i);
  if(renderMatch&&req.method==="POST"){
   const input=await readBody(req);
   try{return send(res,202,{ok:true,render:await startRender(renderMatch[1],input.mode||"proof")})}
   catch(e){
    const stateErrors=["job-not-approved","series-render-worker-not-ready","job-not-owned-render"];
    return send(res,stateErrors.includes(e?.message)?409:400,{ok:false,error:e?.message||"render request failed"});
   }
  }
  const reviewMatch=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})\/review$/i);
  if(reviewMatch&&req.method==="POST"){
   const input=await readBody(req);
   const next=await updateJob(reviewMatch[1],job=>{
    const allowed=Object.keys(job.review||{});
    if(!allowed.includes(input.gate)||typeof input.approved!=="boolean") throw new Error("invalid review gate");
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
 await mkdir(RENDERS,{recursive:true});
 console.log(`KORA KIDS Animation Factory listening on http://${HOST}:${PORT}`);
 console.log(`Workspace: ${WORKSPACE}`);
});

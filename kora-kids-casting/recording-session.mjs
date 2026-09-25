import { readFile, writeFile, mkdir, readdir, copyFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

function parseArgs(){
 const o={workspace:join(homedir(),".izakhono","kora-kids-studio"),mode:"prepare"};
 for(let i=2;i<process.argv.length;i++){
  const k=process.argv[i];
  if(k==="--workspace")o.workspace=process.argv[++i];
  else if(k==="--candidate")o.candidate=process.argv[++i];
  else if(k==="--mode")o.mode=process.argv[++i];
  else if(k==="--session")o.session=process.argv[++i];
  else if(k==="--takes")o.takes=process.argv[++i];
 }
 return o;
}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});if(r.error)throw r.error;if(r.status!==0)throw new Error(cmd+" failed: "+String(r.stderr||"").slice(-2000));return r.stdout}
function probe(path){return JSON.parse(run("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type,codec_name,sample_rate,channels","-of","json",path]))}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function need(v,msg){if(!v)throw new Error(msg)}
function schedule(pack){
 const sceneDur=pack.scenes.map(s=>Number(s.durationSeconds)||1),total=sceneDur.reduce((a,b)=>a+b,0),out=[];let sceneStart=0;
 for(const scene of pack.scenes){
   const dur=Number(scene.durationSeconds)||1,lines=scene.dialogue||[],usable=dur*.78,pad=dur*.11;
   const weights=lines.map(l=>Math.max(3,String(l.text||"").split(/\s+/).filter(Boolean).length)),sum=weights.reduce((a,b)=>a+b,0)||1;
   let cursor=sceneStart+pad,leboIndex=0;
   lines.forEach((line,i)=>{
     const ld=usable*(weights[i]/sum),start=cursor,end=cursor+ld;cursor=end;
     if(line.speaker==="Lebo"){
       leboIndex++;
       out.push({id:scene.id+"-l"+String(leboIndex).padStart(2,"0"),sceneId:scene.id,speaker:"Lebo",text:line.text,emotion:line.emotion||null,factReviewRequired:line.factReviewRequired===true,startSeconds:+start.toFixed(3),endSeconds:+end.toFixed(3),take:null});
     }
   });
   sceneStart+=dur;
 }
 return {lines:out,totalSeconds:total};
}
async function findCandidate(workspace,id){
 const p=join(workspace,"casting","lebo",id,"manifest.json");return {path:p,data:JSON.parse(await readFile(p,"utf8"))};
}
async function prepare(o){
 need(o.candidate,"--candidate is required for prepare mode");
 const workspace=resolve(o.workspace),cand=(await findCandidate(workspace,o.candidate)).data;
 need(cand.selected===true,"candidate is not selected");
 need(cand.rightsReadiness?.productionRightsContracted===true,"production rights are not contracted");
 need(Object.values(cand.review||{}).every(Boolean),"candidate review is incomplete");
 const repo=resolve(new URL("../",import.meta.url).pathname);
 const pack=JSON.parse(await readFile(join(repo,"kora-kids-studio","production","lebo-jabu","jam-day-under-the-baobab.en-ZA.json"),"utf8"));
 const sc=schedule(pack);need(sc.lines.length===17,"expected 17 Lebo lines");
 const id=randomUUID(),root=join(workspace,"recording-sessions","lebo",id);await mkdir(join(root,"takes"),{recursive:true});
 const session={
   schema:"kora-kids.recording-session/v1",id,createdAt:new Date().toISOString(),seriesId:"lebo-jabu",episodeSlug:"jam-day-under-the-baobab",language:"en-ZA",character:"Lebo",
   selectedPerformer:{candidateId:cand.id,performerDisplayName:cand.performerDisplayName,approved:true},
   recordingSpec:{sampleRate:48000,preferredBits:24,channels:1,dry:true},
   durationSeconds:420,lineCount:sc.lines.length,lines:sc.lines,
   complete:false,readyForAssembly:false
 };
 await writeFile(join(root,"session.json"),JSON.stringify(session,null,2)+"\n");
 console.log(JSON.stringify({...session,privateSessionPath:join(root,"session.json")},null,2));
}
async function attach(o){
 need(o.session&&o.takes,"--session and --takes are required for attach mode");
 const sessionPath=resolve(o.session),session=JSON.parse(await readFile(sessionPath,"utf8")),takes=JSON.parse(await readFile(resolve(o.takes),"utf8"));
 need(session.schema==="kora-kids.recording-session/v1","invalid session");
 const root=resolve(sessionPath,"..");await mkdir(join(root,"takes"),{recursive:true});
 for(const line of session.lines){
   const t=takes[line.id];need(t?.path,"missing take for "+line.id);need(t.approved===true,"take not approved for "+line.id);
   const src=resolve(t.path),p=probe(src),audio=p.streams?.find(x=>x.codec_type==="audio");
   need(audio,"take has no audio: "+line.id);const sr=Number(audio.sample_rate||0),dur=Number(p.format?.duration||0);
   need(sr>=44100,"take sample rate too low: "+line.id);need(dur>0&&dur<60,"unexpected take duration: "+line.id);
   const ext=extname(src).toLowerCase()||".wav",dst=join(root,"takes",line.id+ext);await copyFile(src,dst);
   line.take={approved:true,privatePath:dst,sha256:await sha(dst),bytes:(await stat(dst)).size,codec:audio.codec_name,sampleRate:sr,channels:Number(audio.channels||0),durationSeconds:dur,reviewer:t.reviewer||"owner-review"};
 }
 session.complete=session.lines.every(l=>l.take?.approved===true);
 session.readyForAssembly=session.complete;
 session.updatedAt=new Date().toISOString();
 await writeFile(sessionPath,JSON.stringify(session,null,2)+"\n");
 console.log(JSON.stringify({id:session.id,lineCount:session.lines.length,complete:session.complete,readyForAssembly:session.readyForAssembly,performerDisplayName:session.selectedPerformer.performerDisplayName},null,2));
}
const o=parseArgs();(o.mode==="prepare"?prepare(o):o.mode==="attach"?attach(o):Promise.reject(new Error("--mode must be prepare or attach"))).catch(e=>{console.error(e.stack||e.message);process.exit(1)});
